// Tests for verify-identity.mjs. Run: npm test (or node test.mjs).
//
// Only MetaMask can sign a real token, so these tests sign their own with a throwaway key and pass its public half
// as staticKeyPem. That runs the same checks as production: algorithm, audience, expiry, issuer, login type, wallet.
// Forged tokens that claim MetaMask's real key IDs are also checked against MetaMask's live key sets (network needed).

import { SignJWT, exportSPKI, generateKeyPair } from 'jose';
import { secp256k1 } from '@noble/curves/secp256k1';
import { DGEN_CLIENT_ID, DgenSignInError, publicKeyToAddress, verifyDgenSignIn } from './verify-identity.mjs';

const trusted = await generateKeyPair('ES256', { extractable: true });
const untrusted = await generateKeyPair('ES256');
const staticKeyPem = await exportSPKI(trusted.publicKey);

let failed = 0;
let count = 0;
const check = (name, ok, info = '') => {
  count++;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`);
};

const player = () => {
  const priv = secp256k1.utils.randomPrivateKey();
  const pub = Buffer.from(secp256k1.getPublicKey(priv, true)).toString('hex');
  return { pub, address: publicKeyToAddress(pub) };
};
const appKey = (p) => ({ public_key: p.pub, type: 'web3auth_app_key', curve: 'secp256k1' });
const thresholdKey = (p) => ({ public_key: p.pub, type: 'web3auth_threshold_key', curve: 'secp256k1' });
const GOOGLE = { authConnection: 'google', authConnectionId: 'web3auth', groupedAuthConnectionId: 'web3auth-google-sapphire' };
const EMAIL = { authConnection: 'email_passwordless', authConnectionId: 'web3auth', groupedAuthConnectionId: 'web3auth-auth0-email-passwordless-sapphire' };
const DISCORD = { authConnection: 'discord', authConnectionId: 'web3auth', groupedAuthConnectionId: 'web3auth-discord-sapphire' };

async function token(claims, { key = trusted.privateKey, kid = 'local-test', iss = 'web3auth.io', aud = DGEN_CLIENT_ID, exp = '1h', alg = 'ES256' } = {}) {
  let t = new SignJWT(claims).setProtectedHeader({ alg, kid, typ: 'JWT' }).setIssuedAt().setAudience(aud);
  if (iss !== null) t = t.setIssuer(iss);
  if (exp !== null) t = t.setExpirationTime(exp);
  return t.sign(key);
}
const verify = (t, hint) => verifyDgenSignIn(t, hint, { staticKeyPem });
async function rejects(name, t, code, hint) {
  try {
    await verify(t, hint);
    check(name, false, 'accepted');
  } catch (e) {
    check(name, e instanceof DgenSignInError && e.code === code, `${e.code}: ${e.message}`);
  }
}

// Shaped like a real token from the DGEN project (Nov 2026): issuer "web3auth.io", two Ethereum keys.
const p = player();
const other = player();
const realWallets = [thresholdKey(other), { public_key: 'ab'.repeat(32), type: 'web3auth_app_key', curve: 'ed25519' }, appKey(p)];

const g = await verify(await token({ wallets: realWallets, email: 'Player@Example.com', ...GOOGLE }), p.address.toLowerCase());
check('Google: accepted, wallet is the app key (not the threshold key)', g.wallet === p.address && g.wallet !== other.address, g.wallet);
check('Google: email returned, lowercased', g.email === 'player@example.com' && g.loginType === 'google');
const em = await verify(await token({ wallets: realWallets, email: 'player@example.com', ...EMAIL }));
check('email login: accepted with email', em.email === 'player@example.com' && em.loginType === 'email_passwordless');
const d = await verify(await token({ wallets: realWallets, email: 'player.discord@example.com', ...DISCORD }));
check('Discord: accepted, email is null even though the token has one', d.wallet === p.address && d.email === null && d.loginType === 'discord');
const byGroup = await verify(await token({ wallets: realWallets, authConnection: 'web3auth', groupedAuthConnectionId: 'web3auth-google-sapphire' }));
check('authConnection "web3auth" + Google grouped ID: accepted as Google', byGroup.loginType === 'google');

for (const [name, claims] of [
  ['Facebook', { authConnection: 'facebook', groupedAuthConnectionId: 'web3auth-facebook-sapphire' }],
  ['Twitter (grouped ID only)', { groupedAuthConnectionId: 'web3auth-auth0-twitter-sapphire' }],
  ['SMS', { authConnection: 'sms_passwordless' }],
  ['no login claims', {}],
  ['Google/Discord conflict', { authConnection: 'google', groupedAuthConnectionId: 'web3auth-discord-sapphire' }],
]) {
  await rejects(`${name}: rejected`, await token({ wallets: realWallets, email: 'x@example.com', ...claims }), 'login_not_accepted');
}

await rejects('only a threshold key: rejected', await token({ wallets: [thresholdKey(p)], ...GOOGLE }), 'no_wallet');
await rejects('two app keys: rejected', await token({ wallets: [appKey(p), appKey(other)], ...GOOGLE }), 'no_wallet');
await rejects('no wallets: rejected', await token({ ...GOOGLE }), 'no_wallet');
await rejects('browser claims the threshold key address: rejected', await token({ wallets: realWallets, ...GOOGLE }), 'wallet_mismatch', other.address);
await rejects('wallet_address that is not the app key: rejected', await token({ wallets: realWallets, wallet_address: other.address, ...GOOGLE }), 'wallet_mismatch');

await rejects('expired: rejected', await token({ wallets: realWallets, ...GOOGLE }, { exp: Math.floor(Date.now() / 1000) - 60 }), 'token_expired');
await rejects('no expiry: rejected', await token({ wallets: realWallets, ...GOOGLE }, { exp: null }), 'token_invalid');
await rejects('another project (audience): rejected', await token({ wallets: realWallets, ...GOOGLE }, { aud: 'someone-else' }), 'token_invalid');
for (const iss of ['https://web3auth.io', 'web3auth.io/', 'WEB3AUTH.IO', 'api.web3auth.io', 'https://evil.example', null]) {
  await rejects(`issuer ${JSON.stringify(iss)}: rejected`, await token({ wallets: realWallets, ...GOOGLE }, { iss }), 'token_invalid');
}
await rejects('signed by an untrusted key: rejected', await token({ wallets: realWallets, ...GOOGLE }, { key: untrusted.privateKey }), 'token_invalid');
await rejects(
  'forged with the real citadel key ID (live key set): rejected',
  await token({ wallets: realWallets, ...GOOGLE }, { key: untrusted.privateKey, kid: '5Imw8N7KYnswBTF09jMFz8OzgQF8jZSaOQ1buVP5x14' }),
  'token_invalid',
);
const hs = await new SignJWT({ wallets: realWallets, ...GOOGLE }).setProtectedHeader({ alg: 'HS256' }).setIssuer('web3auth.io').setAudience(DGEN_CLIENT_ID).setExpirationTime('1h').sign(new TextEncoder().encode('0123456789abcdef0123456789abcdef'));
await rejects('HS256: rejected', hs, 'token_invalid');
await rejects('missing token: rejected', undefined, 'token_missing');
await rejects('garbage: rejected', 'not-a-token', 'token_missing');

console.log(failed ? `\n${failed} of ${count} FAILED` : `\nAll ${count} checks passed`);
process.exit(failed ? 1 : 0);
