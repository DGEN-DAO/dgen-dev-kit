'use client';

// A sign-in page for a DGEN game.
//
// The rules this follows (all learned the hard way on DGEN's own sign-in page):
//  - connect() never throws. It returns null and sets `error` when sign-in fails or the window is closed.
//  - A session can survive from an earlier visit. Do NOT sign the player in silently: ask first ("Continue as ...").
//    Reusing it silently signs players who logged out of your game straight back in.
//  - Never trust the address the browser reports. Send the identity token to your server and let it decide.
//  - The SDK can fail to start without reporting an error (for example a bad modalConfig name). Do not wait forever.

import { useEffect, useState } from 'react';
import { useAuthTokenInfo, useWeb3Auth, useWeb3AuthConnect, useWeb3AuthDisconnect, useWeb3AuthUser } from '@web3auth/modal/react';

type Result = { wallet: string; loginType: string } | null;

export default function SignInPage() {
  const { isInitialized, initError, connection } = useWeb3Auth();
  const { connect, isConnected, loading: connecting, error: connectError } = useWeb3AuthConnect();
  const { disconnect } = useWeb3AuthDisconnect();
  const { userInfo } = useWeb3AuthUser();
  const { getAuthTokenInfo } = useAuthTokenInfo();

  const [confirmed, setConfirmed] = useState(false); // the player pressed a button on THIS visit
  const [result, setResult] = useState<Result>(null);
  const [problem, setProblem] = useState('');
  const [slow, setSlow] = useState(false);

  // The SDK can hang without an error. Give it 20 seconds, then say so.
  useEffect(() => {
    if (isInitialized) return;
    const t = setTimeout(() => setSlow(true), 20_000);
    return () => clearTimeout(t);
  }, [isInitialized]);

  // Once the player has asked to sign in (on this visit) and a session exists, send the token to the server.
  useEffect(() => {
    if (!confirmed || !isConnected || result || problem) return;
    void (async () => {
      const idToken = await getAuthTokenInfo();
      const accounts = await connection?.ethereumProvider?.request<never, string[]>({ method: 'eth_accounts' }).catch(() => null);
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, address: accounts?.[0] }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) setResult(body);
      else setProblem(body.message ?? `Sign-in refused (${res.status})`);
    })();
  }, [confirmed, isConnected, result, problem, getAuthTokenInfo, connection]);

  async function signIn() {
    setProblem('');
    setConfirmed(true);
    const ok = await connect(); // never throws
    if (!ok) setProblem('Sign-in did not finish. Please try again.');
  }

  async function useDifferentAccount() {
    await disconnect();
    await signIn();
  }

  if (initError || slow) return <p>Sign-in could not load. Check your connection and reload the page.</p>;
  if (!isInitialized) return <p>Loading sign-in…</p>;
  if (result) return <p>Signed in. Wallet {result.wallet}</p>;

  return (
    <main>
      {problem && <p role="alert">{problem}</p>}
      {connectError && !problem && <p role="alert">{connectError.message}</p>}
      {isConnected && !confirmed ? (
        <>
          {/* Discord players are never named by email (Discord is matched by wallet only). */}
          <button onClick={() => setConfirmed(true)}>
            Continue as {userInfo?.authConnection === 'discord' ? 'your Discord account' : userInfo?.email || 'your account'}
          </button>
          <button onClick={useDifferentAccount}>Use a different account</button>
        </>
      ) : (
        <>
          <button onClick={signIn} disabled={connecting}>
            {connecting ? 'Signing in…' : 'Sign in'}
          </button>
          <p>Sign in with Google, Discord or email.</p>
        </>
      )}
    </main>
  );
}
