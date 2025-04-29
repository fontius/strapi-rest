Okay, let's break down the process of setting up CI/CD for your Next.js + Strapi project using GitHub Actions and deploying to a self-hosted Coolify instance.

**Core Concepts:**

1.  **Monorepo Structure:** You have a `client` (Next.js) and a `server` (Strapi) directory in the same repository.
2.  **Dockerization:** Each service (client, server, database) will run in its own Docker container. This ensures consistency between local development and production.
3.  **CI/CD (GitHub Actions):** On pushes/PRs to `main`, GitHub Actions will:
    *   Build both the client and server applications to ensure they compile correctly.
    *   Build Docker images for both client and server.
    *   Push these images to a container registry (Docker Hub in your case).
4.  **Deployment (Coolify):** Coolify will:
    *   Detect pushes to your `main` branch (via GitHub App/Webhooks).
    *   Pull the latest Docker images built by GitHub Actions.
    *   Orchestrate the deployment of your services (client, server, database) based on your `coolify.json` or detected Dockerfiles.
    *   Inject environment variables securely.

**Analysis of Your Provided Files:**

*   `.github/workflows/main.yml`: Looks good. It builds both client and server, logs into Docker Hub, and builds/pushes images tagged with `latest` and the commit SHA. It correctly uses secrets for Docker Hub credentials and variables for the username.
*   `client/Dockerfile` & `server/Dockerfile`: These seem reasonable for production builds.
    *   **Client Dockerfile:** Uses multi-stage builds, which is good. **Potential Issue:** It copies `.env.production` into the image (`COPY --from=builder /app/.env.production ./`). This is generally **not recommended** for secrets. It's better to inject environment variables at runtime (which Coolify does). You might remove this line and rely solely on runtime environment variables.
    *   **Server Dockerfile:** Simple and effective.
*   `docker-compose.yaml`: Excellent for local *production-like* testing. It defines the three services (Next.js, Strapi, Postgres) and their networking.
*   `coolify.json`: This defines your deployment services for Coolify. It correctly references the images built by GitHub Actions (`${DOCKERHUB_USERNAME}/...:${COMMIT_SHA}`) and sets up environment variables using Coolify's variable system (`${POSTGRES_URL}`, `${JWT_SECRET}`, etc.). The healthcheck for the server is also a good practice.
*   `.env.production` (root): This file seems intended for the Strapi server when running in production mode *locally* via Docker Compose maybe? However, its values should ideally be managed via runtime environment variables in Coolify.
*   `server/.env.example`: Standard practice for showing required environment variables.
*   `client/src/app/page.tsx`: Correctly uses `process.env.NEXT_PUBLIC_STRAPI_URL` to fetch data. The fallback is good for handling errors.
*   `server/src/index.ts`: Includes a `/_health` endpoint, which is used by your `coolify.json` healthcheck. Good.
*   `server/config/database.ts`: Correctly checks `NODE_ENV` to potentially switch database clients, although your setup seems focused on Postgres for production. It uses `env()` helpers to read environment variables.

**Step-by-Step Guide:**

**Phase 1: Local Setup & Testing**

1.  **Prerequisites:**
    *   Node.js (v18 or v20 recommended, matching your Dockerfiles) & npm
    *   Docker Desktop installed and running.
    *   Git installed.
    *   VS Code (or your preferred editor).
    *   GitHub account and a repository created for this project.
    *   Coolify instance running and accessible.

2.  **Clone Repository:** Clone your project from GitHub.

3.  **Local Environment Files:**
    *   **Server:**
        *   Navigate to the `server` directory: `cd server`
        *   Copy the example env file: `cp .env.example .env`
        *   Edit `server/.env`:
            *   For **initial local development (easiest)**, you can stick with the default SQLite if you haven't changed `config/database.ts` much. Just fill in dummy values for `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`. Use a tool like `node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"` to generate secure keys.
            *   Leave `HOST=0.0.0.0` and `PORT=1337`.
            *   Make sure `NODE_ENV` is *not* set to `production` here, or ensure `DATABASE_CLIENT` is explicitly set if you want SQLite.
    *   **Client:**
        *   Navigate to the `client` directory: `cd ../client`
        *   Create a local env file: `touch .env.local`
        *   Edit `client/.env.local`:
            ```env
            NEXT_PUBLIC_STRAPI_URL=http://localhost:1337
            ```
            *(This tells your local Next.js dev server where to find the local Strapi API)*.

4.  **Install Dependencies:**
    *   `cd server && npm install`
    *   `cd ../client && npm install`
    *   `cd ..` (back to root)

5.  **Run Locally (Development Mode):**
    *   Open two terminals.
    *   Terminal 1 (Server): `cd server && npm run develop`
    *   Terminal 2 (Client): `cd client && npm run dev`
    *   Access Strapi Admin: `http://localhost:1337/admin` (create your first admin user).
    *   Access Next.js App: `http://localhost:3000`. Create some content in Strapi (specifically the "Home Page" single type) and check if it appears in the Next.js app.

6.  **Test Docker Compose (Local Production Simulation):**
    *   **Important:** Ensure Docker Desktop is running.
    *   From the **root** of your project: `docker-compose up --build -d`
        *   `--build`: Forces Docker to build the images using your Dockerfiles.
        *   `-d`: Runs in detached mode.
    *   This will start Postgres, Strapi (using the `server/Dockerfile` and environment variables from `docker-compose.yaml`), and Next.js (using `client/Dockerfile` and env vars from `docker-compose.yaml`).
    *   **Note:** The Strapi container connects to the `postgres` container using the service name `postgres` as the host (defined in `docker-compose.yaml` and read via `env('DATABASE_HOST')` in `server/config/database.ts`). The Next.js container connects to Strapi using `http://strapi:1337`.
    *   Check logs: `docker-compose logs -f`
    *   Access services:
        *   Next.js: `http://localhost:3000`
        *   Strapi: `http://localhost:1337` (You'll likely need to create an admin user again for this containerized instance unless you map a volume for the database *data*).
    *   When done: `docker-compose down` (stops and removes containers). Use `docker-compose down -v` to also remove the named volume `postgres_data`.

**Phase 2: GitHub Actions & Docker Hub**

1.  **Docker Hub:**
    *   Create a Docker Hub account if you don't have one.
    *   Create two public repositories (or private, if you have a paid plan) named `restaurant-client` and `restaurant-server`.

2.  **GitHub Secrets & Variables:**
    *   In your GitHub repository settings -> Secrets and variables -> Actions:
        *   **Secrets:**
            *   `DOCKERHUB_USERNAME`: Your Docker Hub username.
            *   `DOCKERHUB_TOKEN`: An Access Token generated from Docker Hub (Account Settings -> Security -> New Access Token). **Do not use your password.**
        *   **Variables:**
            *   `DOCKERHUB_USERNAME`: Your Docker Hub username (can be the same value as the secret, but variables are typically for non-sensitive config). Your workflow uses `vars.DOCKERHUB_USERNAME` for image names, so this is correct.

3.  **Commit & Push:** Commit all your files (`.github/workflows/main.yml`, Dockerfiles, `coolify.json`, `docker-compose.yaml`, source code, etc.) and push to your `main` branch on GitHub.

4.  **Monitor GitHub Actions:** Go to the "Actions" tab in your GitHub repository. You should see the "Build and Deploy" workflow running. Verify that it successfully builds the code, builds the Docker images, and pushes them to Docker Hub.

**Phase 3: Coolify Deployment**

1.  **Coolify Prerequisites:**
    *   Ensure your Coolify instance is running and accessible.
    *   Ensure Coolify can reach GitHub.com and Docker Hub.

2.  **Connect GitHub App:**
    *   In Coolify, go to your Server settings -> GitHub App and ensure it's connected to your GitHub account/organization, granting access to your project repository.

3.  **Create Coolify Project/Application:**
    *   Create a new Project in Coolify if needed.
    *   Inside the project, create a new Application. Select "Public GitHub Repository".
    *   Choose your repository and the `main` branch.
    *   **Build Pack:** Coolify *should* detect your `coolify.json` file. If it asks, you might need to point it towards that or potentially configure it for Docker Compose or Nixpacks if `coolify.json` isn't detected automatically (though it usually is). Since you have `coolify.json`, it will likely use that as the primary source of truth for deployment.
    *   **Port:** Coolify will likely detect the ports from `coolify.json` (3000 for client, 1337 for server).

4.  **Configure Environment Variables in Coolify:**
    *   Go to the "Environment Variables" section for your deployed application in Coolify.
    *   You need to add variables that correspond to those used in your `coolify.json`:
        *   **`JWT_SECRET`**: Generate a strong secret key and add it here. (Mark as `Build-time & Runtime`)
        *   **`POSTGRES_PASSWORD`**: Set the desired password for the Coolify-managed Postgres database. (Mark as `Build-time & Runtime`)
        *   **`DOCKERHUB_USERNAME`**: Your Docker Hub username (needed by Coolify to know *which* images to pull, matching the ones pushed by Actions). (Mark as `Build-time & Runtime`)
        *   **(Optional) `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`**: Add these for Strapi if they aren't already hardcoded or derived elsewhere. Generate secure values. (Mark as `Build-time & Runtime`)
    *   **Coolify Managed Postgres:** When Coolify provisions the Postgres service defined in `coolify.json`, it automatically injects the connection URL as `POSTGRES_URL` into the *other* services (`restaurant-server` in this case) that depend on it. Your `server/config/database.ts` already uses `env('DATABASE_URL')`, which Coolify will provide. It also uses individual components like host, port, user, password, database. Coolify often provides these individually too (e.g., `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`). You might need to adjust `server/config/database.ts` slightly if it relies *only* on `DATABASE_URL` and doesn't fall back to individual components, or ensure Coolify provides all the required individual variables. Check the Coolify documentation or the environment variables tab after the first deployment attempt. *Your current `database.ts` seems flexible enough as it reads `DATABASE_HOST`, `DATABASE_PORT`, etc., which Coolify likely injects alongside `DATABASE_URL`.*
    *   **Client Variable:** The `NEXT_PUBLIC_STRAPI_URL` is set correctly within the `coolify.json` to point to the server service name (`http://restaurant-server:1337`). Coolify handles this internal service discovery.

5.  **Deploy:**
    *   Trigger the first deployment manually from the Coolify UI.
    *   Monitor the deployment logs in Coolify. It should:
        *   Pull the Postgres image.
        *   Start the Postgres container.
        *   Pull your `restaurant-server` image (using the commit SHA tag).
        *   Start the `restaurant-server` container, injecting the environment variables and connecting it to Postgres.
        *   Pull your `restaurant-client` image.
        *   Start the `restaurant-client` container, injecting its environment variables.
    *   **Strapi First Run:** The very first time the Strapi container starts against a new database, it needs to build its schema. This might take a little while. Check the logs for the Strapi container (`restaurant-server`).
    *   **Healthcheck:** Coolify will use the `/_health` endpoint defined in `coolify.json` to check if the server is ready.

6.  **Access Deployed App:**
    *   Coolify will provide a URL for your deployed `restaurant-client` service. Access it in your browser.
    *   You should also be able to access the Strapi admin panel via its URL (if Coolify assigns one, or configure ingress if needed, though typically you access the client URL). You'll need to set up the Strapi admin user again on the deployed instance.

**Phase 4: Testing the CI/CD Flow**

1.  Make a small change in your `client` or `server` code.
2.  Commit and push the change to the `main` branch.
3.  Go to GitHub Actions and verify the workflow runs, builds, and pushes the new images with the latest commit SHA tag.
4.  Go to Coolify -> Your Application -> Deployments. You should see a new deployment automatically triggered by the push (via webhook).
5.  Verify Coolify pulls the new images and restarts the relevant containers.
6.  Access the deployed application URL and confirm your change is live.

**Important Considerations:**

*   **Environment Variable Security:** NEVER commit `.env` files containing sensitive information (API keys, database passwords, JWT secrets) to Git. Use `.gitignore` (which you are doing). Rely on Coolify's secure environment variable injection for production.
*   **Database Migrations (Strapi):** For real-world applications, consider how you'll handle database schema migrations as your Strapi models evolve. Strapi doesn't have a built-in migration system like Django or Rails. You might need manual steps or explore community plugins/strategies.
*   **Strapi Build:** The `strapi build` command is run inside the `server/Dockerfile`. Ensure this process has enough memory allocated in the container during deployment, especially for larger projects.
*   **Tailwind CSS 4:** Ensure your `postcss.config.js` and `tailwind.config.js` (if you have one) are correctly set up for Tailwind 4, as its configuration might differ from v3. Your `postcss.config.js` looks basic, assuming `@tailwindcss/postcss` handles most things.
*   **Coolify Resources:** Ensure your self-hosted Coolify server has sufficient CPU, RAM, and disk space to run the database, client, and server containers.

This detailed guide should help you navigate the setup process for your Next.js/Strapi monorepo deployment on Coolify using GitHub Actions. Remember to check the logs frequently in both GitHub Actions and Coolify during setup and troubleshooting.