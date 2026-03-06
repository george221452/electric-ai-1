import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
  typescript: true,
});

export const STRIPE_PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER || '',
  pro: process.env.STRIPE_PRICE_PRO || '',
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || '',
};

export const STRIPE_PRODUCTS = {
  starter: {
    name: 'Starter',
    description: 'Pentru utilizatori individuali',
    price: 29,
    tokens: 1000,
    features: [
      '1,000 tokens/lună',
      '5 documente',
      'Suport email',
      'Acces la toate configurațiile RAG',
    ],
  },
  pro: {
    name: 'Pro',
    description: 'Pentru profesioniști',
    price: 79,
    tokens: 5000,
    features: [
      '5,000 tokens/lună',
      'Documente nelimitate',
      'Prioritate la procesare',
      'Suport prioritar',
      'API access',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Pentru echipe',
    price: 199,
    tokens: 20000,
    features: [
      '20,000 tokens/lună',
      'Documente nelimitate',
      'Procesare prioritară',
      'Suport dedicat 24/7',
      'API access',
      'Workspace-uri multiple',
      'Onboarding personalizat',
    ],
  },
};

export type PlanType = keyof typeof STRIPE_PRODUCTS;

export function getPlanFromPriceId(priceId: string): PlanType | null {
  if (priceId === STRIPE_PRICE_IDS.starter) return 'starter';
  if (priceId === STRIPE_PRICE_IDS.pro) return 'pro';
  if (priceId === STRIPE_PRICE_IDS.enterprise) return 'enterprise';
  return null;
}

export function calculateTokensFromUsage(
  operation: 'query' | 'upload' | 'process' | 'ai_format',
  params?: { pages?: number; tokens?: number }
): number {
  switch (operation) {
    case 'query':
      return 1;
    case 'upload':
      return 5;
    case 'process':
      return (params?.pages || 1) * 2;
    case 'ai_format':
      return 3;
    default:
      return 1;
  }
}
