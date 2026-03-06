import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { plan } = body;

    // Mock checkout for testing
    return NextResponse.json({
      success: true,
      url: `https://stripe.com/test-checkout?plan=${plan}`,
    });
  } catch (error) {
    console.error('[Stripe Checkout] Error:', error);
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 });
  }
}
