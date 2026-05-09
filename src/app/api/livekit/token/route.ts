import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // ══════════════════════════════════════════════════════════
  // STEP 1: Read and validate env vars BEFORE anything else
  // ══════════════════════════════════════════════════════════
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  // Server-side uses LIVEKIT_URL, fallback to NEXT_PUBLIC_LIVEKIT_URL
  const wsUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL;

  const envDiag = {
    LIVEKIT_API_KEY: apiKey ? `SET (${apiKey.length} chars, starts: ${apiKey.substring(0, 4)}...)` : '❌ MISSING',
    LIVEKIT_API_SECRET: apiSecret ? `SET (${apiSecret.length} chars)` : '❌ MISSING',
    LIVEKIT_URL: process.env.LIVEKIT_URL || '❌ MISSING',
    NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL || '❌ MISSING',
    resolvedWsUrl: wsUrl || '❌ NONE AVAILABLE',
  };

  console.log('[LiveKit Token API] === ENV DIAGNOSTIC ===', JSON.stringify(envDiag, null, 2));

  if (!apiKey) {
    return NextResponse.json({ error: 'LIVEKIT_API_KEY is not set', env: envDiag }, { status: 500 });
  }
  if (!apiSecret) {
    return NextResponse.json({ error: 'LIVEKIT_API_SECRET is not set', env: envDiag }, { status: 500 });
  }
  if (!wsUrl) {
    return NextResponse.json({ error: 'Neither LIVEKIT_URL nor NEXT_PUBLIC_LIVEKIT_URL is set', env: envDiag }, { status: 500 });
  }

  // ══════════════════════════════════════════════════════════
  // STEP 2: Validate wsUrl protocol (must be wss:// not https://)
  // ══════════════════════════════════════════════════════════
  let finalWsUrl = wsUrl;
  if (finalWsUrl.startsWith('https://')) {
    finalWsUrl = finalWsUrl.replace('https://', 'wss://');
    console.warn(`[LiveKit Token API] ⚠️ Converted https:// to wss:// → ${finalWsUrl}`);
  } else if (!finalWsUrl.startsWith('wss://') && !finalWsUrl.startsWith('ws://')) {
    finalWsUrl = `wss://${finalWsUrl}`;
    console.warn(`[LiveKit Token API] ⚠️ Added wss:// prefix → ${finalWsUrl}`);
  }

  // ══════════════════════════════════════════════════════════
  // STEP 3: Parse request params
  // ══════════════════════════════════════════════════════════
  try {
    const room = req.nextUrl.searchParams.get('room')?.trim();
    const username = req.nextUrl.searchParams.get('username')?.trim();
    const rawRole = req.nextUrl.searchParams.get('role')?.trim() || '';
    const normalizedRole = rawRole.toLowerCase();

    console.log(`[LiveKit Token API] Request → room="${room}", username="${username}", role="${rawRole}" (normalized="${normalizedRole}")`);

    if (!room) {
      return NextResponse.json({ error: 'Missing "room" query parameter' }, { status: 400 });
    }
    if (!username) {
      return NextResponse.json({ error: 'Missing "username" query parameter' }, { status: 400 });
    }

    // ══════════════════════════════════════════════════════════
    // STEP 4: Create token
    // ══════════════════════════════════════════════════════════
    console.log('[LiveKit Token API] Creating AccessToken with apiKey:', apiKey.substring(0, 4) + '...');
    
    const at = new AccessToken(apiKey, apiSecret, {
      identity: username,
      ttl: '10m',
    });

    const canPublish = normalizedRole !== 'audience';
    
    console.log(`[LiveKit Token API] Adding grant: roomJoin=true, room="${room}", canPublish=${canPublish}, canSubscribe=true, canPublishData=true`);
    
    at.addGrant({
      roomJoin: true,
      room: room,
      canPublish,
      canSubscribe: true,
      canPublishData: true,
    });

    // ══════════════════════════════════════════════════════════
    // STEP 5: Sign JWT
    // ══════════════════════════════════════════════════════════
    console.log('[LiveKit Token API] Signing JWT...');
    const token = await at.toJwt();
    console.log(`[LiveKit Token API] ✅ SUCCESS → token length=${token.length} for "${username}" in "${room}"`);

    return NextResponse.json({ token });

  } catch (error: any) {
    // ══════════════════════════════════════════════════════════
    // FULL ERROR DUMP — visible in Vercel logs AND client
    // ══════════════════════════════════════════════════════════
    const errMsg = error?.message || String(error) || 'Unknown crash';
    const errStack = error?.stack || 'No stack trace';
    const errName = error?.name || 'Error';
    
    console.error('╔══════════════════════════════════════════╗');
    console.error('║  [LiveKit Token API] ❌ FATAL CRASH      ║');
    console.error('╚══════════════════════════════════════════╝');
    console.error('Name:', errName);
    console.error('Message:', errMsg);
    console.error('Stack:', errStack);
    console.error('Env state:', JSON.stringify(envDiag));

    // Return EVERYTHING to the client so F12 shows the real cause
    return NextResponse.json(
      {
        error: errMsg,
        errorName: errName,
        stack: errStack,
        env: envDiag,
        hint: 'Check Vercel Environment Variables: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL must be set in Vercel Dashboard → Settings → Environment Variables',
      },
      { status: 500 }
    );
  }
}
