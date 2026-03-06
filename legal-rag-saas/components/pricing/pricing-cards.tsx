"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";
import { STRIPE_PRODUCTS, PlanType } from "@/lib/stripe/config";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export function PricingCards() {
  const [loading, setLoading] = useState<PlanType | null>(null);
  const { data: session } = useSession();
  const router = useRouter();

  const handleSubscribe = async (plan: PlanType) => {
    if (!session) {
      router.push("/auth/signin");
      return;
    }

    setLoading(plan);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          successUrl: `${window.location.origin}/dashboard?success=true`,
          cancelUrl: `${window.location.origin}/pricing?canceled=true`,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
    } finally {
      setLoading(null);
    }
  };

  const plans: PlanType[] = ["starter", "pro", "enterprise"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
      {plans.map((plan) => {
        const product = STRIPE_PRODUCTS[plan];
        const isLoading = loading === plan;

        return (
          <Card key={plan} className={plan === "pro" ? "border-primary shadow-lg scale-105" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">{product.name}</CardTitle>
                {plan === "pro" && <Badge>Popular</Badge>}
              </div>
              <CardDescription>{product.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <span className="text-4xl font-bold">${product.price}</span>
                <span className="text-muted-foreground">/lună</span>
              </div>

              <div className="text-center">
                <Badge variant="secondary" className="text-lg">
                  {product.tokens.toLocaleString()} tokens
                </Badge>
              </div>

              <ul className="space-y-3">
                {product.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                size="lg"
                onClick={() => handleSubscribe(plan)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Alege ${product.name}`
                )}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
