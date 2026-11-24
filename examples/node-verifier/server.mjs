// A minimal Node server (no framework) with the one endpoint a DGEN game needs: POST /api/session.
//
//   npm ci
//   node server.mjs            # http://localhost:8787
//
// The browser sends { idToken, address } after sign-in (see ../html/src/main.js or ../nextjs/).
// This verifies the token and answers with the player's wallet. Replace the TODO with your own session handling.

import { createServer } from 'node:http';
import { DgenSignInError, verifyDgenSignIn } from './verify-identity.mjs';

const PORT = Number(process.env.PORT ?? 8787);

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 20_000) throw new Error('too large');
  }
  return JSON.parse(body);
}

const server = createServer(async (req, res) => {
  const send = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };
  if (req.method !== 'POST' || req.url !== '/api/session') return send(404, { error: 'not found' });

  let body;
  try {
    body = await readJson(req);
  } catch {
    return send(400, { error: 'bad request' });
  }

  try {
    const player = await verifyDgenSignIn(body?.idToken, body?.address, {
      staticKeyPem: process.env.DGEN_VERIFICATION_KEY, // optional, see verify-identity.mjs
    });
    // TODO: find or create your player and set your own session cookie.
    //  - A player can have several wallets: each login method (Google, email, Discord) gives its own.
    //    Keep a list of wallets per player; do not treat one wallet as the whole player.
    //  - player.email is set only for Google and email logins, which prove it. You may join those by email.
    //  - player.email is null for Discord: find a Discord player by player.wallet only, never by email.
    return send(200, { wallet: player.wallet, loginType: player.loginType });
  } catch (e) {
    if (e instanceof DgenSignInError) return send(401, { error: e.code, message: e.message });
    console.error('verify failed', e);
    return send(500, { error: 'server_error' });
  }
});

server.listen(PORT, () => console.log(`DGEN sign-in verifier on http://localhost:${PORT}/api/session`));
