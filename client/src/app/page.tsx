
async function getHomePageData() {
  const BASE_URL = process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
  try {
    const res = await fetch(`${BASE_URL}/api/home-page`, {
      next: { revalidate: 60 }
    });
    
    if (!res.ok) throw new Error('Failed to fetch menu');
    const { data } = await res.json();
    return {
      title: data?.title || "Island Breeze Beach Bar & Grill",
      description: data?.description || "Fresh seafood & tropical cocktails by the ocean"
    };
  } catch (error) {
    console.error('Using fallback content:', error);
    return {
      title: "Island Breeze Beach Bar & Grill",
      description: "Fresh seafood & tropical cocktails by the ocean"
    };
  }
}

export default async function Home() {
  const { title, description } = await getHomePageData();

  return (
    <main className="min-h-screen bg-gradient-to-b from-tropical-sand to-tropical-teal/10">
      <section className="max-w-4xl mx-auto px-4 py-16">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
          <h1 className="text-tropical-teal text-5xl font-bold mb-6 text-center font-lobster">
            {title}
          </h1>
          <p className="text-tropical-navy text-lg leading-relaxed text-center mb-8">
            {description}
          </p>
          
          <div className="grid md:grid-cols-2 gap-8 mt-12">
            <div className="bg-tropical-coral/10 p-6 rounded-xl">
              <h2 className="text-tropical-coral text-2xl font-bold mb-4">Todays Specials</h2>
              <p className="text-tropical-navy">Grilled Mahi Mahi • Coconut Shrimp • Pineapple Rum Punch</p>
            </div>
            
            <div className="bg-tropical-teal/10 p-6 rounded-xl">
              <h2 className="text-tropical-teal text-2xl font-bold mb-4">Hours</h2>
              <p className="text-tropical-navy">11AM - 11PM Daily<br/>Live Music Fridays</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
