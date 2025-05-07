async function loader () {
  const path = "/api/home-page";
  // For server-side fetches, use the internal URL.
  // process.env.STRAPI_INTERNAL_URL will be available on the server.
  const BASE_URL = process.env.STRAPI_INTERNAL_URL || "http://localhost:1337"; // Fallback for safety
  const url = new URL (path, BASE_URL);

  console.log(`Fetching from: ${url.href}`); // Good for debugging

  try {
    const response = await fetch(url.href);

    if (!response.ok) {
      // Log more details if the response is not OK
      const errorText = await response.text();
      console.error(`Fetch failed with status: ${response.status}`, errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    console.log(data);

    // Make sure data.data exists before spreading
    return data && data.data ? { ...data.data } : {};
  } catch (error) {
    console.error("Error in loader function:", error);
    // Re-throw or handle appropriately for Next.js error page
    throw error;
  }
}

export default async function HomeRoute () {
  let data = { title: "Error loading title", description: "Error loading description" }; // Default error state
  try {
    data = await loader();
  } catch (error) {
    console.error("Failed to load data for HomeRoute:", error);
    // Optionally, you could render a specific error component here
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold mb-4 text-gray-800">{data.title}</h1>
        <p className="text-lg text-gray-600">{data.description}</p>
      </div>
    </div>
  );
}