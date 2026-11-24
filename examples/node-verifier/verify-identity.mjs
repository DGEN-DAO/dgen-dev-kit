// Verify a DGEN sign-in on YOUR server. Plain JavaScript (Node 18+), no framework.
//
// These are the rules DGEN's own sign-in server (the DGEN Hub) enforces. Every rule below was proven against
// real tokens from the DGEN project in Nov 2026. If you change a rule, you are no longer matching what the
// Hub accepts.
//
//   import { verifyDgenSignIn } from './verify-identity.mjs';
//   const player = await verifyDgenSignIn(idToken, addressFromBrowser);
//   // player.wallet is the DGEN wallet. player.email is null unless the login proves the player owns it.
//
// Dependencies: jose, @noble/curves, @noble/hashes (see package.json).

import { createRemoteJWKSet, decodeJwt, decodeProtectedHeader, importSPKI, jwtVerify } from 'jose';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';

// ---------------------------------------------------------------------------------------------------------
// Public values (not secrets)
// ---------------------------------------------------------------------------------------------------------

/** The DGEN MetaMask Embedded Wallets project. Every DGEN game uses this one, so a login gets the same wallet in every game (each login method has its own). */
export const DGEN_CLIENT_ID = 'BJSdiTtpco_9HstmItQALR6AxzhNZBinQJ1qVB1Z5XKWaTjNjr8pYnfcRAWuoFzz8YlRvrQNCyZkSjEnAsM5pGQ';

const ALGORITHM = 'ES256';

// Trusted signing keys. A token must be signed by one of them AND carry that set's issuer exactly.
// The order does not matter; the verifier tries the set whose issuer matches the token first.
const KEY_SETS = [
  // Documented by MetaMask for social logins.
  { id: 'api-auth', jwks: 'https://api-auth.web3auth.io/jwks', issuer: 'https://api-auth.web3auth.io' },
  // Documented by MetaMask for external-wallet logins.
  { id: 'authjs', jwks: 'https://authjs.web3auth.io/jwks', issuer: 'https://authjs.web3auth.io' },
  // NOT in MetaMask's docs, but this is the set that signs the tokens SDK 11 actually issues. Its issuer is
  // exactly "web3auth.io": no https://, no path. Verifying only against the documented sets fails with
  // ERR_JWKS_NO_MATCHING_KEY (that is how we found it).
  { id: 'citadel', jwks: 'https://api.web3auth.io/citadel-service/.well-known/jwks.json', issuer: 'web3auth.io' },
].map((s) => ({ ...s, getKey: createRemoteJWKSet(new URL(s.jwks)) })); // jose caches each set

const KNOWN_ISSUERS = new Set(KEY_SETS.map((s) => s.issuer));

/** Logins DGEN accepts. Every other login type is refused. */
export const ALLOWED_LOGINS = ['google', 'email_passwordless', 'discord'];
/** Of those, the ones that prove the player owns the email in the token. Discord does NOT. */
export const EMAIL_PROVING_LOGINS = ['google', 'email_passwordless'];

// Grouped connection IDs of the accepted logins in the DGEN project (sapphire_mainnet).
const GROUP_TO_METHOD = {
  'web3auth-google-sapphire': 'google',
  'web3auth-auth0-email-passwordless-sapphire': 'email_passwordless',
  'web3auth-discord-sapphire': 'discord',
};
// Login method names the SDK knows. Any other value in authConnection (for example "web3auth") says nothing.
const KNOWN_METHODS = new Set([
  'google', 'twitter', 'facebook', 'discord', 'farcaster', 'apple', 'github', 'reddit', 'line', 'kakao', 'linkedin',
  'twitch', 'telegram', 'wechat', 'email_passwordless', 'sms_passwordless', 'passkeys', 'authenticator', 'custom',
]);

// ---------------------------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------------------------

export class DgenSignInError extends Error {
  /** @param {'token_missing'|'token_invalid'|'token_expired'|'no_wallet'|'wallet_mismatch'|'login_not_accepted'} code */
  constructor(code, message) {
    super(message);
    this.name = 'DgenSignInError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------

const str = (v) => (typeof v === 'string' && v.trim() !== '' ? v : null);
const joseCode = (e) => (typeof e?.code === 'string' ? e.code : '');

function toChecksumAddress(hex40) {
  const lower = hex40.toLowerCase();
  const hash = Buffer.from(keccak_256(new TextEncoder().encode(lower))).toString('hex');
  let out = '0x';
  for (let i = 0; i < 40; i++) out += parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
  return out;
}

/** Ethereum address for a secp256k1 public key in hex (compressed, as in the token, or uncompressed). */
export function publicKeyToAddress(publicKeyHex) {
  const hex = publicKeyHex.startsWith('0x') ? publicKeyHex.slice(2) : publicKeyHex;
  const uncompressed = secp256k1.ProjectivePoint.fromHex(hex).toRawBytes(false); // 0x04 + 64 bytes
  const hash = Buffer.from(keccak_256(uncompressed.slice(1))).toString('hex');
  return toChecksumAddress(hash.slice(-40));
}

function normaliseAddress(value) {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value) ? toChecksumAddress(value.slice(2)) : null;
}

// ---------------------------------------------------------------------------------------------------------
// Step 1: signature, algorithm, audience, expiry, issuer
// ---------------------------------------------------------------------------------------------------------

async function verifySignature(token, { clientId, staticKeyPem }) {
  let alg, iss;
  try {
    alg = decodeProtectedHeader(token).alg;
    iss = str(decodeJwt(token).iss) ?? '';
  } catch {
    throw new DgenSignInError('token_invalid', 'The identity token is not a readable JWT.');
  }
  if (alg !== ALGORITHM) throw new DgenSignInError('token_invalid', `Only ${ALGORITHM} tokens are accepted.`);

  // The same checks on every path. requiredClaims: jose only checks expiry when "exp" is present.
  const options = { algorithms: [ALGORITHM], audience: clientId, requiredClaims: ['exp'] };
  const fail = (e) =>
    joseCode(e) === 'ERR_JWT_EXPIRED'
      ? new DgenSignInError('token_expired', 'The sign-in has expired.')
      : new DgenSignInError('token_invalid', `The identity token did not verify (${joseCode(e) || 'ERR_UNKNOWN'}).`);

  const ordered = [...KEY_SETS].sort((a, b) => Number(b.issuer === iss) - Number(a.issuer === iss));
  for (const set of ordered) {
    try {
      const { payload } = await jwtVerify(token, set.getKey, options);
      if (iss === set.issuer) return payload; // exact match, no patterns
    } catch (e) {
      const code = joseCode(e);
      if (code === 'ERR_JWKS_NO_MATCHING_KEY') continue; // this set does not hold the key: try the next one
      if (code.startsWith('ERR_JWT_') || code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') throw fail(e);
      // Anything else (network trouble fetching a key set): try the next set.
    }
  }

  // Optional: the project's static "Verification Key" from the MetaMask dashboard. Ask the DGEN DAO team if you need it.
  if (staticKeyPem) {
    try {
      const key = await importSPKI(staticKeyPem.replace(/\\n/g, '\n'), ALGORITHM);
      const { payload } = await jwtVerify(token, key, options);
      if (KNOWN_ISSUERS.has(iss)) return payload;
    } catch (e) {
      if (joseCode(e).startsWith('ERR_JWT_')) throw fail(e);
    }
  }
  throw new DgenSignInError('token_invalid', 'No trusted key verifies this identity token.');
}

// ---------------------------------------------------------------------------------------------------------
// Step 2: login type
// ---------------------------------------------------------------------------------------------------------

/** Reads the login type from the verified claims. Only authConnection and groupedAuthConnectionId are used. */
export function loginFromClaims(payload) {
  const method = str(payload.authConnection)?.toLowerCase() ?? null;
  const fromMethod = method && KNOWN_METHODS.has(method) ? method : null;
  const group = str(payload.groupedAuthConnectionId);
  const fromGroup = group ? GROUP_TO_METHOD[group] ?? null : null;
  const conflict = !!(fromMethod && fromGroup && fromMethod !== fromGroup);
  const type = fromMethod ?? fromGroup;
  const allowed = !conflict && !!type && ALLOWED_LOGINS.includes(type);
  return { type, allowed, emailProven: allowed && EMAIL_PROVING_LOGINS.includes(type) };
}

// ---------------------------------------------------------------------------------------------------------
// Step 3: wallet
// ---------------------------------------------------------------------------------------------------------

/**
 * The player's wallet is the token's ONE "web3auth_app_key" on secp256k1. Real tokens also carry a
 * "web3auth_threshold_key" with a DIFFERENT address: never use it. An ed25519 app key may also be present: ignore it.
 */
function walletFromClaims(payload, addressHint) {
  const wallets = Array.isArray(payload.wallets) ? payload.wallets : [];
  const appKeys = wallets.filter((w) => w && w.type === 'web3auth_app_key' && w.curve === 'secp256k1');
  if (appKeys.length !== 1) {
    throw new DgenSignInError('no_wallet', `The token must hold exactly one web3auth_app_key on secp256k1; it holds ${appKeys.length}.`);
  }
  let wallet;
  try {
    wallet = publicKeyToAddress(String(appKeys[0].public_key));
  } catch {
    throw new DgenSignInError('no_wallet', 'The web3auth_app_key in the token is not a valid public key.');
  }
  // Cross-checks only. Neither can choose the wallet.
  const claim = normaliseAddress(str(payload.wallet_address)); // real tokens have none so far
  if (claim && claim !== wallet) throw new DgenSignInError('wallet_mismatch', 'wallet_address does not match the app key.');
  const hint = normaliseAddress(addressHint);
  if (hint && hint !== wallet) throw new DgenSignInError('wallet_mismatch', 'The wallet in the browser does not match the signed-in account.');
  return wallet;
}

// ---------------------------------------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------------------------------------

/**
 * Verifies a DGEN identity token and returns who signed in. Throws DgenSignInError if anything is wrong.
 *
 * @param {unknown} idToken      From web3auth.getAuthTokenInfo() in the browser (useAuthTokenInfo() in React).
 * @param {unknown} addressHint  Optional: the address the browser reports (eth_accounts). Only a cross-check.
 * @param {{ clientId?: string, staticKeyPem?: string }} [options]
 * @returns {Promise<{ wallet: string, email: string | null, loginType: string, expiresAt: number }>}
 *   `email` is the token's email for Google and email logins, and null for Discord: match Discord players by
 *   wallet only, never by email.
 */
export async function verifyDgenSignIn(idToken, addressHint, options = {}) {
  const clientId = options.clientId ?? DGEN_CLIENT_ID;
  if (typeof idToken !== 'string' || idToken.split('.').length !== 3) {
    throw new DgenSignInError('token_missing', 'No identity token was provided.');
  }
  const payload = await verifySignature(idToken, { clientId, staticKeyPem: options.staticKeyPem });

  const login = loginFromClaims(payload);
  if (!login.allowed) throw new DgenSignInError('login_not_accepted', 'Sign in with Google, Discord or email.');

  const wallet = walletFromClaims(payload, addressHint);
  const tokenEmail = str(payload.email)?.toLowerCase() ?? null;
  return { wallet, email: login.emailProven ? tokenEmail : null, loginType: login.type, expiresAt: payload.exp };
}
