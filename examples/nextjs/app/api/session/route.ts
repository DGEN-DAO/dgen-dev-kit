// Server side of the sign-in: verify the identity token, then start your own session.
//
// lib/verify-identity.mjs is an identical copy of ../node-verifier/verify-identity.mjs (that folder has its tests).
// Copy it into your own project the same way.

import { NextResponse } from 'next/server';
import { DgenSignInError, verifyDgenSignIn } from '../../../lib/verify-identity.mjs';

export const runtime = 'nodejs'; // jose's remote key sets and the crypto here need Node, not the edge runtime
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { idToken?: unknown; address?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  try {
    const player = await verifyDgenSignIn(body.idToken, body.address, {
      staticKeyPem: process.env.DGEN_VERIFICATION_KEY, // optional, server only, never NEXT_PUBLIC_
    });

    // TODO: find or create your player and set your own session cookie.
    //  - A player can have several wallets: each login method (Google, email, Discord) gives its own.
    //    Keep a list of wallets per player; do not treat one wallet as the whole player.
    //  - player.email is set only for Google and email logins, which prove it. You may join those by email.
    //  - player.email is null for Discord: find a Discord player by player.wallet only, never by email.
    return NextResponse.json({ wallet: player.wallet, loginType: player.loginType }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof DgenSignInError) {
      return NextResponse.json({ error: e.code, message: e.message }, { status: 401 });
    }
    console.error('sign-in verify failed', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
