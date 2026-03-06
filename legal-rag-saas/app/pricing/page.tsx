import { PricingCards } from "@/components/pricing/pricing-cards";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">LegalRAG</Link>
          <div className="flex items-center gap-4">
            <Link href="/auth/signin"><Button variant="ghost">Sign In</Button></Link>
          </div>
        </div>
      </header>

      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold mb-4">Prețuri simple și transparente</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Alege planul potrivit pentru nevoile tale. Toate planurile includ acces la toate funcționalitățile.
            </p>
          </div>

          <PricingCards />
        </div>
      </section>
    </div>
  );
}
