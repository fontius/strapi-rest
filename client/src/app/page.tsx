async function getHomePageData() {
  const BASE_URL = process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
  try {
    const res = await fetch(`${BASE_URL}/api/home-page`, {
      next: { revalidate: 60 }
    });

    if (!res.ok) throw new Error('Failed to fetch home page');
    const { data } = await res.json();
    return {
      id: data?.id,
      documentId: data?.documentId,
      title: data?.title || "Beach Bar & Grill",
      description: data?.description || "& tropical cocktails by the ocean",
      createdAt: data?.createdAt,
      updatedAt: data?.updatedAt,
      publishedAt: data?.publishedAt,
    };
  } catch (error) {
    console.error('Using fallback content:', error);
    return {
      id: null,
      documentId: null,
      title: "Island Breeze Beach Bar & Grill",
      description: "Fresh seafood & tropical cocktails by the ocean",
      createdAt: null,
      updatedAt: null,
      publishedAt: null,
    };
  }
}

export default async function Home() {
  const { title, description } = await getHomePageData();

  return (
    <main className="min-h-screen bg-gradient-to-b from-tropical-sand to-tropical-teal/10">
      <section className="max-w-4xl mx-auto px-4 py-16">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
          <h1 className="text-5xl font-bold mb-6 text-center font-lobster">
            {title}
          </h1>
          <p className="text-lg text-amber-200 leading-relaxed text-center mb-8">
            {description}
          </p>
       
        </div>
      </section>
    </main>
  );
}