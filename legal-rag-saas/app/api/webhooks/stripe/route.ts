import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    
    // Mock webhook processing for testing
    console.log('[Stripe Webhook] Received webhook');
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
