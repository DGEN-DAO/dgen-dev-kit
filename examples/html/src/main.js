// DGEN sign-in from a plain HTML/JS page.
//
// Same Client ID and network as every DGEN game, so a login gets the same wallet here as everywhere else.
// Each login METHOD has its own wallet (Google and email with the same address differ): see the README.
// After sign-in this sends the identity token to YOUR server (POST /api/session). Never trust the address the
// browser reports on its own: your server must verify the token (see ../node-verifier/).
//
// Why a build step: no CDN can serve @web3auth/modal 11.4.3 to a page directly (checked Nov 2026: jsDelivr's
// "+esm" fails on a dependency pinned to a pre-release URL, esm.sh mis-bundles "loglevel"). Vite bundles it;
// the page itself stays plain HTML and JS. The SDK draws its sign-in window with React, so react and react-dom
// must be installed even though this page does not use React itself (see package.json).

import { Web3Auth, WEB3AUTH_NETWORK, WALLET_CONNECTORS } from '@web3auth/modal';

// Public values, the same in every DGEN game. Not secrets.
const CLIENT_ID = 'BJSdiTtpco_9HstmItQALR6AxzhNZBinQJ1qVB1Z5XKWaTjNjr8pYnfcRAWuoFzz8YlRvrQNCyZkSjEnAsM5pGQ';

// Login methods switched on in the project that DGEN games do NOT accept. Hiding them is allowed on the free
// plan. Never list "farcaster": the SDK no longer supports it and throws where nothing catches it, so sign-in
// never finishes loading.
const HIDDEN_LOGINS = ['twitter', 'facebook', 'apple', 'github', 'reddit', 'line', 'kakao', 'linkedin', 'twitch', 'wechat', 'sms_passwordless'];

const web3auth = new Web3Auth({
  clientId: CLIENT_ID,
  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
  chains: [
    {
      chainNamespace: 'eip155',
      chainId: '0x2105', // Base mainnet (8453): DGEN lives on Base
      rpcTarget: 'https://mainnet.base.org',
      displayName: 'Base',
      blockExplorerUrl: 'https://basescan.org',
      ticker: 'ETH',
      tickerName: 'Ethereum',
      logo: 'https://images.toruswallet.io/eth.svg', // required by the SDK's chain config type
    },
  ],
  defaultChainId: '0x2105',
  // DGEN games offer Google, Discord and email only: no outside wallets (MetaMask, Phantom, Rabby and so on).
  // It takes all three of these settings. Leave one out and wallets come back:
  //  1. multiInjectedProviderDiscovery: false   do not list the wallet extensions found in the player's browser.
  //     Without it a player with Phantom or Rabby installed sees it under "OR" in the sign-in window.
  //     A browser with no extensions never shows the problem, so test with one that has a wallet installed.
  //  2. the four wallets hidden by name below
  //  3. hideWalletDiscovery: true               no "Other wallets" list
  multiInjectedProviderDiscovery: false,
  modalConfig: {
    hideWalletDiscovery: true,
    connectors: {
      [WALLET_CONNECTORS.AUTH]: {
        label: 'auth',
        showOnModal: true,
        loginMethods: Object.fromEntries(HIDDEN_LOGINS.map((name) => [name, { showOnModal: false }])),
      },
      [WALLET_CONNECTORS.METAMASK]: { label: 'MetaMask', showOnModal: false },
      [WALLET_CONNECTORS.WALLET_CONNECT_V2]: { label: 'WalletConnect', showOnModal: false },
      [WALLET_CONNECTORS.COINBASE]: { label: 'Coinbase', showOnModal: false },
      [WALLET_CONNECTORS.BASE_ACCOUNT]: { label: 'Base Account', showOnModal: false },
    },
  },
  // No uiConfig: custom names, themes and logos count as whitelabel, which the free plan rejects at sign-in.
});

const status = document.getElementById('status');
const button = document.getElementById('signin');

async function sendToServer() {
  status.textContent = 'Checking your sign-in…';
  const { idToken } = await web3auth.getAuthTokenInfo();
  const [address] = await web3auth.provider.request({ method: 'eth_accounts' });
  // Your server verifies the token and decides who this is. `address` is only a cross-check.
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, address }),
  });
  const body = await res.json().catch(() => ({}));
  status.textContent = res.ok ? `Signed in. Wallet ${body.wallet}` : `Sign-in refused: ${body.error ?? res.status}`;
}

button.addEventListener('click', async () => {
  button.disabled = true;
  try {
    await web3auth.connect(); // opens the sign-in window; resolves when signed in, rejects if closed
    await sendToServer();
  } catch (e) {
    status.textContent = `Sign-in did not finish: ${e?.message ?? e}`;
  } finally {
    button.disabled = false;
  }
});

try {
  await web3auth.init();
  // A session from an earlier visit is still there. Ask before using it; do not sign the player in silently.
  // (Reusing it silently signs players who logged out of your game straight back in.)
  status.textContent = web3auth.connected ? 'You are already signed in. Press Sign in to continue.' : '';
  button.disabled = false;
} catch (e) {
  status.textContent = `Sign-in could not load: ${e?.message ?? e}`;
}
