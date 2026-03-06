import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">
            LegalRAG
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Platformă RAG pentru documente legale și tehnice cu citate 100% verificate.
            Pune întrebări în limbaj natural și primește răspunsuri bazate exclusiv pe documentele tale.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard">
              <Button size="lg">Începe gratuit</Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="lg">
                Vezi prețuri
              </Button>
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              title="Citate Verificate"
              description="Fiecare răspuns include citate exacte din surse cu validare automată."
              icon="✓"
            />
            <FeatureCard
              title="100% Acuratețe"
              description="Sistem anti-halucinație care garantează exactitatea informațiilor."
              icon="🎯"
            />
            <FeatureCard
              title="Multi-Document"
              description="Interoghează simultan multiple documente pentru răspunsuri complete."
              icon="📚"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="p-6 bg-card rounded-lg border">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
