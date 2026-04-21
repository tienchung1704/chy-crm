import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('crm_access_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Call backend NestJS API
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const response = await fetch(`${backendUrl}/users/onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `crm_access_token=${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.message || 'Failed to complete onboarding' },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Trigger Pancake sync asynchronously if needed
    if (result.shouldSyncPancake && result.user?.id) {
      console.log(`[Onboarding] Triggering Pancake sync for user ${result.user.id}`);
      fetch(`${backendUrl}/users/${result.user.id}/sync-pancake-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(e => console.error('Pancake sync error:', e));
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}
