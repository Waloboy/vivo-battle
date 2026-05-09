import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const room = req.nextUrl.searchParams.get('room')?.trim();
    const username = req.nextUrl.searchParams.get('username')?.trim();
    const rawRole = req.nextUrl.searchParams.get('role')?.trim() || '';
    
    // Normalize role: accept any casing (audience, Audience, AUDIENCE → audience)
    const normalizedRole = rawRole.toLowerCase();
    
    console.log(`[LiveKit Token API] Request - Room: "${room}", Username: "${username}", Role: "${rawRole}" → normalized: "${normalizedRole}"`);

    if (!room) {
      return NextResponse.json({ error: 'Missing "room" query parameter' }, { status: 400 });
    }
    if (!username) {
      return NextResponse.json({ error: 'Missing "username" query parameter' }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    console.log('[LiveKit Token API] Env check:', {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      hasApiSecret: !!apiSecret,
      apiSecretLength: apiSecret?.length || 0,
      hasWsUrl: !!wsUrl,
      wsUrl: wsUrl || 'NOT SET',
    });

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json(
        { error: 'Server misconfigured: missing LIVEKIT env vars', detail: { hasApiKey: !!apiKey, hasApiSecret: !!apiSecret, hasWsUrl: !!wsUrl } },
        { status: 500 }
      );
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: username,
      ttl: '10m',
    });

    // Audience can't publish but everyone else can
    const canPublish = normalizedRole !== 'audience';
    at.addGrant({
      roomJoin: true,
      room: room,
      canPublish,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    console.log(`[LiveKit Token API] ✅ Token generated for "${username}" in room "${room}" (canPublish=${canPublish})`);
    
    return NextResponse.json({ token });
  } catch (error: any) {
    // Surface the REAL error message so it's visible in Vercel logs AND in the client response
    const message = error?.message || 'Unknown error generating token';
    const stack = error?.stack || '';
    console.error('[LiveKit Token API] ❌ CRASH:', message, '\nStack:', stack);
    return NextResponse.json({ error: message, stack: process.env.NODE_ENV === 'development' ? stack : undefined }, { status: 500 });
  }
}
