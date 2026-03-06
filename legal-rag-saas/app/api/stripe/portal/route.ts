import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Mock response for testing
    return NextResponse.json({ 
      success: true, 
      url: 'https://stripe.com/test-portal' 
    });
  } catch (error) {
    console.error('[Stripe Portal] Error:', error);
    return NextResponse.json({ error: 'Failed to create portal' }, { status: 500 });
  }
}
