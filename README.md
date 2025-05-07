 **Clients can access the live Strapi admin panel hosted on Coolify to manage content without interfering with ongoing development.

**I. Core Components & Architecture**

1.  **Next.js Client (`client/`):**
    *   **Purpose:** The frontend application that users interact with. It's responsible for rendering the UI, fetching data from the Strapi backend, and handling user input.
    *   **Technology:** React (via Next.js), TypeScript, Tailwind CSS.
    *   **Key Files:**
        *   `client/src/app/page.tsx`: Fetches and displays data from the Strapi `/api/home-page`.
        *   `client/Dockerfile`: Defines how to build the production Docker image for the Next.js app.
        *   `client/next.config.ts`: Next.js specific configurations.
        *   `client/package.json`: Manages frontend dependencies and scripts.

2.  **Strapi Server (`server/`):**
    *   **Purpose:** The backend Headless CMS. It provides a REST API for the Next.js client to consume, an admin panel for content managers to update data, and handles business logic.
    *   **Technology:** Strapi (Node.js framework), TypeScript, PostgreSQL (in production/dockerized dev).
    *   **Key Files:**
        *   `server/src/api/home-page/`: Defines the "Home Page" content type (schema, controller, service, routes).
        *   `server/config/database.ts`: Configures database connections. It's set up to use PostgreSQL in production (`NODE_ENV === 'production'`) and defaults to SQLite for basic local runs if not overridden by environment variables.
        *   `server/config/server.ts`: Configures server host, port, and app keys.
        *   `server/Dockerfile`: Defines how to build the production Docker image for the Strapi app.
        *   `server/package.json`: Manages backend dependencies and scripts.
        *   `server/src/index.ts`: Custom Strapi bootstrap logic, notably adding a `/_health` endpoint for health checks.

3.  **PostgreSQL Database (`postgres` service):**
    *   **Purpose:** The persistent data store for Strapi. All content types, users, roles, etc., created in Strapi are stored here.
    *   **Technology:** PostgreSQL (Docker image `postgres:15`).

4.  **Docker & Orchestration:**
    *   **`docker-compose.yaml` (Local Development):** Defines and orchestrates the multi-container application for local development. It sets up the `nextjs`, `strapi`, and `postgres` services, their networking, volumes for live code reloading, and environment variables (often sourced from a `.env` file).
    *   **`coolify.json` (Coolify Deployment):** Defines the services for deployment on Coolify. It specifies the Docker images to use (built by GitHub Actions and pushed to Docker Hub), ports, environment variables (some using Coolify secrets/variables), and dependencies between services.
    *   **`Dockerfile`s (in `client/` and `server/`):** Instructions to build the standalone Docker images for the Next.js client and Strapi server, respectively. These are used by GitHub Actions and then pulled by Coolify.

5.  **GitHub & CI/CD:**
    *   **`.github/workflows/main.yml` (GitHub Actions):** Defines the Continuous Integration/Continuous Deployment pipeline. On pushes/PRs to `main`:
        1.  Checks out code.
        2.  Builds the Next.js client.
        3.  Builds the Strapi server.
        4.  Logs into Docker Hub.
        5.  Builds Docker images for both client and server using their respective `Dockerfile`s.
        6.  Tags images with `latest` and the Git commit SHA.
        7.  Pushes these images to Docker Hub (if not a PR).

**II. How Data is Passed Around**

1.  **Content Creation/Management (Strapi Admin):**
    *   A content manager logs into the Strapi admin panel (e.g., `http://localhost:1337/admin` locally, or the Coolify-hosted URL in production).
    *   They create or update content for defined content types (e.g., the "Home Page" with its `title` and `description` fields as per `server/src/api/home-page/content-types/home-page/schema.json`).
    *   When they save, Strapi writes this data to the PostgreSQL database.

2.  **Frontend Data Fetching (Next.js Client):**
    *   The `client/src/app/page.tsx` component needs to display the home page title and description.
    *   Its `loader` function makes an HTTP GET request to the Strapi API:
        *   **Locally:** `fetch("http://localhost:1337/api/home-page")`. The `localhost:1337` resolves to the Strapi container running locally.
        *   **On Coolify:** The URL would be derived from `NEXT_PUBLIC_STRAPI_URL` environment variable in `coolify.json`, which is `http://restaurant-server:1337`. This `restaurant-server` is the service name of the Strapi container within Coolify's internal network.
    *   Strapi receives this request, its `home-page` controller/service fetches the data from the PostgreSQL database, and returns it as JSON.
    *   The Next.js `loader` function receives the JSON, processes it (`data.data`), and the `HomeRoute` component renders the `title` and `description` on the page.

**III. Docker Container Communication**

**A. Local Development (via `docker-compose.yaml`)**

1.  **Network:** All services (`postgres`, `strapi`, `nextjs`) are defined within the same `docker-compose.yaml` and are automatically part of a default Docker network (or explicitly `strapi-network` as defined). This allows them to communicate using their service names as hostnames.
2.  **`nextjs` to `strapi`:**
    *   The `nextjs` service in `docker-compose.yaml` would typically have an environment variable like `NEXT_PUBLIC_STRAPI_URL=http://strapi:1337` (this would be set in the `.env` file referenced by `env_file`).
    *   When the Next.js app in the `nextjs` container tries to fetch from `http://strapi:1337`, Docker's internal DNS resolves `strapi` to the IP address of the `strapi` container on the shared Docker network.
3.  **`strapi` to `postgres`:**
    *   The `strapi` service in `docker-compose.yaml` has environment variables (from `.env`) like:
        *   `DATABASE_CLIENT=postgres`
        *   `DATABASE_HOST=postgres` (service name of the PostgreSQL container)
        *   `DATABASE_PORT=5432`
        *   `DATABASE_NAME=${POSTGRES_DB}`
        *   `DATABASE_USERNAME=${POSTGRES_USER}`
        *   `DATABASE_PASSWORD=${POSTGRES_PASSWORD}`
    *   Strapi uses these to connect to the `postgres` service on port `5432`.
4.  **Host to Containers (Port Mapping):**
    *   `nextjs`: `ports: - "3000:3000"` maps port 3000 of the `nextjs` container to port 3000 on your local machine. You access it via `http://localhost:3000`.
    *   `strapi`: `ports: - "1337:1337"` maps port 1337 of the `strapi` container to port 1337 on your local machine. You access Strapi admin/API via `http://localhost:1337`.
    *   `postgres`: Typically, its port (`5432`) is not mapped to the host unless you need direct DB access from your host machine, as other containers access it via the internal Docker network.

**B. Deployed on Coolify (via `coolify.json`)**

1.  **Network:** Coolify manages its own internal networking for services deployed within the same application or project. Services can typically resolve each other by their service names.
2.  **`restaurant-client` (Next.js) to `restaurant-server` (Strapi):**
    *   The `restaurant-client` service has an environment variable `NEXT_PUBLIC_STRAPI_URL="http://restaurant-server:1337"`.
    *   Coolify's network resolves `restaurant-server` to the internal IP of the Strapi container.
3.  **`restaurant-server` (Strapi) to `postgres`:**
    *   The `restaurant-server` service has an environment variable `DATABASE_URL="${POSTGRES_URL}"`.
    *   `POSTGRES_URL` is a variable that Coolify likely injects, containing the full connection string to its managed PostgreSQL service (e.g., `postgres://strapi:<password>@postgres-service-internal-host:5432/restaurant_db`).
    *   The `postgres` service in `coolify.json` defines how Coolify should set up this managed PostgreSQL instance.
4.  **External Access (Port Mapping):**
    *   Coolify automatically handles exposing the specified ports (e.g., `3000` for client, `1337` for server) to the internet, often through a reverse proxy that also handles SSL.

**IV. VS Code, GitHub, Monorepo Workflow**

1.  **Monorepo Structure:** Your entire project (client, server, configs) is in one Git repository. This simplifies management and versioning.
2.  **Local Development with VS Code:**
    *   You open the root of the monorepo in VS Code.
    *   You edit code in either `client/` or `server/` directories.
    *   You run `docker-compose up --build` (or similar) in the root directory.
    *   **Live Reloading:**
        *   **`nextjs` service:** The `volumes: - ./client:/app:delegated` and `command: npm run dev` in `docker-compose.yaml` mean that changes you make to `./client` source files on your host machine are immediately reflected inside the `nextjs` container. `npm run dev` (Next.js development server) watches these files and triggers Hot Module Replacement (HMR) or a page reload in your browser.
        *   **`strapi` service:** Similarly, `volumes: - ./server:/app:delegated` and `command: npm run develop` ensure that changes to `./server` source files are reflected inside the `strapi` container. Strapi's development mode (`strapi develop`) watches for changes and auto-restarts the server.
3.  **GitHub Integration:**
    *   You commit your changes (`git commit`) and push them to a GitHub branch (`git push`).
    *   You create a Pull Request to the `main` branch.
    *   **CI (GitHub Actions):** The `.github/workflows/main.yml` workflow runs on the PR:
        *   Builds client and server code (as a test to ensure they build correctly).
        *   It might run linters or tests if configured (not explicitly shown but good practice).
        *   For PRs, it *doesn't* push images to Docker Hub (`push: ${{ github.event_name != 'pull_request' }}`).
    *   Once the PR is reviewed and merged into `main`:
        *   **CD (GitHub Actions & Coolify):**
            1.  The same GitHub Action workflow runs again, but this time `github.event_name` is `push` (to `main`).
            2.  It builds the client and server applications.
            3.  It builds the Docker images for `client` and `server` using their respective `Dockerfile`s.
            4.  It tags these images with `latest` and the specific `github.sha` (commit hash).
            5.  It pushes these images to Docker Hub (`${vars.DOCKERHUB_USERNAME}/restaurant-client` and `.../restaurant-server`).
            6.  **Coolify Trigger:** Coolify is likely configured to monitor these Docker Hub image tags (e.g., the `:latest` tag or by being triggered via a webhook from GitHub when the workflow completes successfully). When it detects a new image version (matching `${DOCKERHUB_USERNAME}/restaurant-client:${COMMIT_SHA}` from `coolify.json`, where `COMMIT_SHA` is supplied by Coolify based on the Git commit), it pulls the new images from Docker Hub.
            7.  Coolify then redeploys the `restaurant-client` and `restaurant-server` services using the updated images and configurations from `coolify.json`. It handles starting/stopping containers, updating environment variables if they've changed in `coolify.json`, and managing the persistent `postgres_data` volume for the database.

**Key Workflow Summary:**

Developer codes locally (VS Code) -> Runs/tests with `docker-compose` -> Pushes to GitHub -> GitHub Actions builds images and pushes to Docker Hub -> Coolify detects new images and redeploys the application.

This setup provides a robust, reproducible, and automated development and deployment pipeline.