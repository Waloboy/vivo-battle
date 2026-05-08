import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const room = req.nextUrl.searchParams.get('room')?.trim();
    const username = req.nextUrl.searchParams.get('username')?.trim();
    const role = req.nextUrl.searchParams.get('role');
    
    console.log(`[LiveKit Token API] Request received - Room: "${room}", Username: "${username}", Role: "${role}"`);

    if (!room) {
      return NextResponse.json({ error: 'Missing "room" query parameter' }, { status: 400 });
    } else if (!username) {
      return NextResponse.json({ error: 'Missing "username" query parameter' }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      console.error('[LiveKit Token API] Server misconfigured. Checking environment variables:', {
        hasApiKey: !!apiKey,
        hasApiSecret: !!apiSecret,
        hasWsUrl: !!wsUrl
      });
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: username,
      ttl: '10m', // Token expires in 10 minutes
    });

    const canPublish = role !== 'Audience';
    at.addGrant({ roomJoin: true, room: room, canPublish, canPublishData: true });

    const token = await at.toJwt();
    console.log(`[LiveKit Token API] Token successfully generated for ${username}`);
    
    return NextResponse.json({ token });
  } catch (error) {
    console.error('[LiveKit Token API] Unexpected Error:', error);
    return NextResponse.json({ error: 'Internal server error while generating token' }, { status: 500 });
  }
}
