'use client';

// DGEN sign-in provider for a React / Next.js (App Router) game.
// These are the settings DGEN's own sign-in page (hub.dgendao.com) runs with.
//
// Packages: see package.json. The SDK lists Solana packages as peers that conflict with each other; DGEN does not
// use Solana, so .npmrc sets legacy-peer-deps=true and they are not installed. With that setting npm does not
// install peers for you, which is why @babel/runtime (needed by the SDK's own packages) is listed directly.

import { useState } from 'react';
import { Web3AuthProvider, type Web3AuthContextConfig } from '@web3auth/modal/react';
import { WALLET_CONNECTORS, WEB3AUTH_NETWORK } from '@web3auth/modal';

// Public values (not secrets). Every DGEN game uses this project, so a login has the same wallet everywhere.
// Each login METHOD has its own wallet (Google and email with the same address differ): see the README.
const DGEN_CLIENT_ID = 'BJSdiTtpco_9HstmItQALR6AxzhNZBinQJ1qVB1Z5XKWaTjNjr8pYnfcRAWuoFzz8YlRvrQNCyZkSjEnAsM5pGQ';

// Login methods switched on in the project that DGEN games do NOT accept; hidden in the sign-in window.
// Every name must be one the SDK accepts. NEVER add 'farcaster': the SDK no longer supports it, and listing it
// makes the SDK throw where nothing catches it (sign-in never loads).
const HIDDEN_LOGINS = ['twitter', 'facebook', 'apple', 'github', 'reddit', 'line', 'kakao', 'linkedin', 'twitch', 'wechat', 'sms_passwordless'] as const;

function buildConfig(): Web3AuthContextConfig {
  return {
    web3AuthOptions: {
      clientId: DGEN_CLIENT_ID,
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
      //  1. multiInjectedProviderDiscovery: false   do not list the wallet extensions found in the player's
      //     browser. Without it a player with Phantom or Rabby installed sees it under "OR" in the sign-in
      //     window. A browser with no extensions never shows the problem, so test with one that has a wallet.
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
      // No uiConfig: app name, theme and logo count as whitelabel, which the free plan rejects at sign-in.
    },
  };
}

export default function DgenSignInProvider({ children }: { children: React.ReactNode }) {
  // Built once per mount: the SDK modifies the modalConfig object it is given.
  const [config] = useState(buildConfig);
  return <Web3AuthProvider config={config}>{children}</Web3AuthProvider>;
}
