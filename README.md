# DGEN sign-in: developer kit

For developers building games for DGEN DAO who want players to sign in with their DGEN sign-in: the same Google, Discord or email login, and the same wallet, they already use on dgendao.com. Your game can be built on any stack. The examples cover Next.js (React), a plain HTML/JS page, and a Node server.

**Checked against what is live on 23 Nov 2026.** The examples were built and run again, on their own, on 24 Nov 2026. Where something was not tested, it says so.

**Contact:** DM `@Tjbonitz` on the DGEN DAO Discord. That is who this guide means by "the DGEN DAO team": for getting a domain allowed, for questions, and for anything here that does not match what you see.

## At a glance: what works today and what does not

| | Today |
| --- | --- |
| Sign in with Google, Discord or email | **Works.** One MetaMask Embedded Wallets project, shared by every DGEN game |
| A wallet created at sign-in, on Base | **Works** |
| Same wallet in every DGEN game, for the same login | **Works**, once your domain is on the project's allowed list. Checked with one Google login on two different sites |
| Same wallet whichever way the player signs in | **Does NOT work.** Google, email and Discord each give a DIFFERENT wallet, even for the same email address. See the next section |
| A token your server can check | **Works.** A signed token (JWT) carrying the wallet, and for Google and email a proven email |
| Signing a message with the wallet (`personal_sign`) | **Works** |
| Your domain on the allowed list | **Only once the DGEN DAO team has added it.** A sign-in cannot be completed on any other address. Ask them, then check it yourself (see "Getting your domain allowed") |
| Signed in once, signed in everywhere | **Does NOT work.** Each site has its own session. The player signs in again on each site, and gets the same wallet if they use the same login |
| A DGEN sign-in page that sends the player back to YOUR game | **Does not exist.** DGEN's own sign-in page (hub.dgendao.com) serves dgendao.com only. Your game runs the sign-in itself, with the examples here |
| A shared account: one player record, username or profile across games | **Does not exist.** Planned. Each game keeps its own players |
| DGEN balances your game can read or change | **Does not exist.** DGEN does not put tokens in sign-in wallets today. In-game DGEN on dgendao.com is kept by that site, and there is no API for it |
| Real DGEN, prizes or NFTs sent to the sign-in wallet | **Do not do this yet.** Players cannot export the wallet's key or withdraw, and the wallet address may change once (see "What may change") |
| Exporting the wallet's key, the SDK's wallet screens | **Do not work** on the current plan |
| Linking an outside wallet (MetaMask, Rabby) to a player | **Not built.** Outside wallets are hidden in the sign-in window on purpose |

## Existing players

Your game already has players who signed up by email. To let one of them in with DGEN sign-in and keep their account:

1. **Verify the token on your server** (see "Verifying the player on your server"). Take nothing from the browser.
2. **For a Google or email login, take the `email` from the verified token**, lower-cased. Both logins prove the player owns that address: Google reports the address of the Google account they signed in to, and the email login only completes after they enter a code sent to that address. The token has no separate "verified" flag. The login type is what tells you, which is why your server must read it.
3. **Find your existing player by that email**, compared lower-cased. Found: sign them in as that player. Not found: create a new player.
4. **Attach the wallet from the token to that account**, with its login type. Add it to a list, and never replace one that is already there. The same person signing in with Google one day and email the next arrives with two different wallets. Both proved the same email, so both belong to the one account.

Three things to get right:

- **Discord cannot be matched this way.** A Discord login gives you a wallet and no email you can trust (the example verifier returns `email: null` for it). An existing player who arrives through Discord first looks like a new player. Tell existing players to use Google or email the first time, or let a player add Discord from inside an account they are already signed in to.
- **Match only on addresses your own sign-up confirmed.** If your old sign-up accepted an email without confirming it, someone may have registered an address that is not theirs. Matching would put the real owner into an account that person set up and can still open with the old password. For those accounts, ask the player to confirm, or switch off the old password when the DGEN sign-in is attached.
- **Refuse `@wallet.dgendao.com` addresses** (see "Email and Discord" below).

What is tested: a real Google token carries the account's email, and dgendao.com matches Google and email logins to its own accounts by this email, live since 18 Nov 2026 (both checked by hand). We have not recorded a real email-login or Discord token field by field, so check both on your staging domain.

## The one thing to design around: one player, several wallets

Each login method gives its own wallet, even for the same email address. Checked on 18 Nov 2026 with one person and one email address: Google gave one address, email code gave a different one. Discord is a third.

Why: in the project, each login method is its own "connection" with its own group (`web3auth-google-sapphire`, `web3auth-auth0-email-passwordless-sapphire`, `web3auth-discord-sapphire`; read from the project's public configuration on 23 Nov 2026). The vendor's documentation says separate connections "produce different wallet addresses for the same person unless you link them with a group connection".

What that means for your game:

- **Do not treat "same email" as "same wallet".** A player who used Google last week and email today arrives with a different wallet.
- **Do not treat a wallet as the whole player.** Keep a player record of your own, with a list of wallets (address, login type, first seen). If you join a Google login and an email login into one player by their proven email, that player now has two wallets. Do not overwrite the first wallet on later logins.
- **Pay one wallet per player.** Choose a primary wallet (today: the first one you saw for that player) and show it. Never pay "the wallet of this sign-in".
- **Tell players to sign in the same way every time.** DGEN's own sign-in page says "Use the same one you used before."
- **Discord is never joined to anything by email** (see "Email and Discord" below).
- **Do not use the wallet address as the only permanent key for a player.** For Google and email logins the proven email is the steadier key. See "What may change".

## The values you need

These are public; they are in every DGEN page's browser code. Not secrets.

| Setting | Value |
| --- | --- |
| Provider | MetaMask Embedded Wallets (formerly Web3Auth), SDK `@web3auth/modal` 11.4.3 |
| Client ID | `BJSdiTtpco_9HstmItQALR6AxzhNZBinQJ1qVB1Z5XKWaTjNjr8pYnfcRAWuoFzz8YlRvrQNCyZkSjEnAsM5pGQ` |
| Network | `sapphire_mainnet` |
| Chain | Base mainnet, chain ID `0x2105` (8453). DGEN is on Base. |

Use exactly these. A different Client ID or network gives players DIFFERENT wallets.

## Getting your domain allowed

The SDK refuses to complete a sign-in on a domain that is not on the project's allowed list. **Ask the DGEN DAO team to add yours**, and give them every address you will use (production, staging, preview), each written out in full with `https://`. Each address is its own entry: `https://yourgame.com` and `https://www.yourgame.com` are two different ones, and allowing the first does not allow the second (checked 24 Nov 2026). The vendor's documentation says wildcard entries such as `https://*.yourgame.com` are possible; we have not tried one.

**Check it yourself.** The project's public configuration answers for any origin. This is the request the SDK makes in every browser:

```
curl -s -H "Origin: https://yourgame.example" \
  "https://api.web3auth.io/signer-service/api/v2/configuration?project_id=BJSdiTtpco_9HstmItQALR6AxzhNZBinQJ1qVB1Z5XKWaTjNjr8pYnfcRAWuoFzz8YlRvrQNCyZkSjEnAsM5pGQ&network=sapphire_mainnet"
```

Look at `whitelist.urls` in the answer. If your address is in it, you are allowed. An address that is not allowed gets an empty list. Use your real address as the Origin: a `localhost` origin gets a different kind of answer, and localhost is not allowed on this project.

## Local development

The project is on `sapphire_mainnet`, and mainnet projects do not allow `localhost`. Your options:

| Option | What works | Trade-offs |
| --- | --- | --- |
| **1. localhost with the real Client ID** | The SDK starts and the sign-in window opens and shows the right buttons (checked with both browser examples here). | Completing a sign-in is refused, because localhost is not allowed. Fine for building pages and layout; not for the sign-in itself. |
| **2. Test the server side with your own signed tokens** | Your verifier can be tested fully without any sign-in: sign test tokens with a throwaway key and give the verifier its public half as a "static key". This is how `examples/node-verifier/test.mjs` works. | Never ship with a test key configured. It proves your rules, not MetaMask's tokens. |
| **3. Deploy to an allowed staging domain** | Real sign-in, real wallets, same as production. | Slower loop (deploy to test). Needs the domain allowed. |
| **4. A tunnel with a fixed hostname** (a reserved ngrok or Cloudflare Tunnel hostname), allowed | Real sign-in against your local machine. | The hostname must be stable and allowed. Anyone who controls that hostname can use the project, so use one you own, and ask for it to be removed when you stop. Not tried by us. |
| **5. A separate `sapphire_devnet` project of your own** (devnet allows localhost) | Real sign-in on localhost. | A different project, so DIFFERENT wallets from production. Useless for checking a real player's wallet. Your verifier must accept that project's Client ID as audience while testing. Not tried by us. |

Our suggestion: 1 + 2 for everyday work, 3 before release.

## Signing players in (browser)

Examples:
- Next.js (React): `examples/nextjs/`. A complete small app: `app/providers.tsx` (the settings), `app/signin/page.tsx` (the page), `app/api/session/route.ts` (the server check).
- Plain HTML/JS: `examples/html/` (`index.html`, `src/main.js`).

Both were built and run on 24 Nov 2026 in a browser with wallet extensions present, at computer and phone size: the SDK starts and the window shows only Google, Discord and email. A sign-in was not completed with either (localhost is not allowed). Their settings are the ones DGEN's live sign-in page runs with.

The steps in any stack:
1. Create the SDK with the values above and the settings from the examples. Do not pass `uiConfig`.
2. `init()`, then `connect()` when the player presses your button.
3. After sign-in, get the identity token: `getAuthTokenInfo()` (React: `useAuthTokenInfo().getAuthTokenInfo()`), and optionally the address (`eth_accounts`).
4. POST both to your server. Your server decides who the player is (next section).

**Hiding outside wallets takes three settings.** DGEN sign-in offers Google, Discord and email, and nothing else. Leave one of these out and wallets come back:

1. `multiInjectedProviderDiscovery: false`. Without it the SDK lists every wallet extension it finds in the player's browser (Phantom, Rabby and so on) under "OR". We missed this at first, because our test browser had no extensions. **Test your sign-in window in a browser that has a wallet extension installed.**
2. MetaMask, WalletConnect, Coinbase and Base Account hidden by name in `modalConfig.connectors`.
3. `modalConfig.hideWalletDiscovery: true` (the "Other wallets" list).

If a player does sign in with an outside wallet or any other login method, your server must refuse it (see "Login type" below). The window only hides buttons.

Lessons learned the hard way:
- **No build step is not an option.** No CDN serves this SDK version to a plain page (checked Nov 2026: jsDelivr `+esm` fails on a dependency pinned to a pre-release URL; esm.sh mis-bundles `loglevel`). Use a bundler (the plain example uses Vite).
- **Install `react` and `react-dom` even without React.** The SDK draws its window with React (and needs `viem`). Without them the build fails.
- **Set `legacy-peer-deps=true` in `.npmrc`.** The SDK lists Solana packages as peers that conflict with each other, so a plain `npm install` fails. DGEN does not use Solana. With that setting npm no longer installs peers for you: DGEN's own Next.js app would not build until `@babel/runtime` (7.x) was listed directly, so the Next.js example lists it.
- **`connect()` (React hook) never throws.** It returns null and sets `error` when sign-in fails or the player closes the window.
- **The SDK can fail to start without any error.** If a `modalConfig` login name is not one the SDK accepts, it throws where nothing catches it and never becomes ready. Put a time limit on loading (DGEN uses 20 seconds) and show an error with a retry.
- **Never list `farcaster`.** SDK 11 no longer supports it, and listing it in `modalConfig` breaks sign-in (it never finishes loading). The SDK accepts all login names except `custom`, `passkeys`, `telegram`, `authenticator` and `farcaster`.
- **Do not reuse a leftover session silently.** A session survives page reloads. If you sign returning visitors straight in, players who logged out of your game are signed back in. Show "Continue as <name>" and "Use a different account" instead.
- **Logging out of your game does not end the sign-in session.** Call the SDK's `logout()` too.
- **A session lasts one day.** After that the player signs in again (the project's setting, read 23 Nov 2026). Do not build on a longer one.
- **Phones inside other apps.** Google blocks its sign-in inside many apps' built-in browsers (links opened from social apps or wallet apps). Email sign-in is the fallback there. We have not tested this ourselves; test it where your players come from.

## Verifying the player on your server

Never trust an address sent by the browser. Verify the identity token on your server.

Use `examples/node-verifier/verify-identity.mjs` (plain JavaScript, Node 18+, depends on `jose`, `@noble/curves`, `@noble/hashes`). It applies the rules DGEN's own sign-in server applies. DGEN keeps the two in step with a test that runs the same 95 tokens through both and checks they agree on every one (run again on 24 Nov 2026 against this exact file). `examples/node-verifier/server.mjs` is a minimal server around it. If you use another language, port these rules exactly:

**1. Signature and claims** (all required, on every path):
- Algorithm `ES256` only. Reject anything else (`HS256`, `none`, ...).
- Audience (`aud`) = the DGEN Client ID.
- `exp` present and not passed. (Some JWT libraries skip the expiry check when `exp` is missing; require it.)
- Signed by a key from one of these key sets, AND the token's issuer (`iss`) equals that set's issuer EXACTLY:

| Key set | JWKS URL | Issuer (exact) | Notes |
| --- | --- | --- | --- |
| citadel | `https://api.web3auth.io/citadel-service/.well-known/jwks.json` | `web3auth.io` | **Signs the tokens SDK 11 issues.** Not in MetaMask's docs. Issuer has no `https://` and no path. |
| api-auth | `https://api-auth.web3auth.io/jwks` | `https://api-auth.web3auth.io` | Documented for social logins. Our tokens are NOT signed by it. |
| authjs | `https://authjs.web3auth.io/jwks` | `https://authjs.web3auth.io` | Documented for outside-wallet logins. |

  If you verify only against the documented sets, every real token fails with `ERR_JWKS_NO_MATCHING_KEY`. That is how we found the citadel set. Match issuers exactly; no patterns (look-alikes such as `https://web3auth.io`, `web3auth.io/` and `api.web3auth.io` must fail). The citadel set is undocumented, so it could change without notice: if every sign-in suddenly fails verification, look there first, and tell the DGEN DAO team.
- Optional fallback: the project's static "Verification Key" from the MetaMask dashboard, as a PEM public key. Ask the DGEN DAO team if you need it. The issuer must still be one of the three above.

**2. Login type.** Read only these claims (they are what real tokens carry):
- `authConnection`: the login method, for example `google`. Use it when it is a known method name.
- `groupedAuthConnectionId`: `web3auth-google-sapphire` (Google), `web3auth-auth0-email-passwordless-sapphire` (email), `web3auth-discord-sapphire` (Discord). Decides when `authConnection` does not name a method (for example when it says `web3auth`).
- `authConnectionId` is `web3auth` for every method. Never use it to decide.
- Accept only `google`, `email_passwordless` and `discord`. Reject anything else, a token that does not say, and a token whose two claims disagree. The project has other login methods switched on that DGEN does not accept, so this check is what keeps them out.

**3. Wallet.** The player's wallet is the token's `wallets` entry with `type` `web3auth_app_key` and `curve` `secp256k1`: derive the address from its compressed `public_key`. There must be exactly ONE such entry, or reject.
- Real tokens also carry a `web3auth_threshold_key`. It gives a DIFFERENT address. Never use it.
- An ed25519 `web3auth_app_key` may be present. Not an Ethereum key; ignore it.
- The app-key address equals what the browser reports (`eth_accounts`) and the player's existing DGEN wallet for that login method (checked with a real DGEN account). Another login method gives another address.
- An address from the browser, or a `wallet_address` claim (real tokens have none so far), is a cross-check only: if present and different, reject. It never chooses the wallet.

**4. Email and Discord.**
- Google and email logins prove the player owns the token's `email`. You may match players by it.
- **Discord is matched by wallet only.** Treat the email as absent for Discord, even when the token has one. Never look a player up by an empty email (that matches some other player with no email).
- **Refuse any email ending in `@wallet.dgendao.com`.** DGEN uses that domain for placeholder addresses on accounts that have no real email. It is not a mailbox and proves nothing. The example verifier does not do this for you; add the check where you match players by email.

What is tested and what is not: the rules above were checked with a real Google token from the live project. An email sign-in works on the live site (checked by hand on 23 Nov 2026). A real Discord sign-in has not been reported to us either way, and we have not recorded the claims of a real Discord token, so treat the Discord rules as "as designed" and test Discord yourself before you rely on it.

## What your players already have on dgendao.com

- **dgendao.com (CoverQuest, PropStreak) signs players in with this same project**, through DGEN's sign-in page at hub.dgendao.com. So a player's Google, Discord or email login gives the same wallet in your game as it does there.
- **The wallet address shown on a dgendao.com account is not always that wallet.** Players who joined with the old MetaMask button keep their MetaMask address on their account after moving to a Google or email sign-in. Do not assume the address a player quotes from dgendao.com is the wallet your game sees.
- **None of it is available to your game as a service.** There is no API to ask "who is this player on dgendao.com" or "what is their balance".

## Plan limits

The project is on MetaMask's free (Base) plan. What that means, as seen in practice or as the vendor publishes it:

- **No `uiConfig` / whitelabel.** App name, theme, logo and similar settings are rejected at sign-in. Leave `uiConfig` out entirely. Hiding login methods and wallets IS allowed (DGEN does it).
- **No key export.** `eth_private_key` returns "Non-200 status code: '401'", and `showWalletUI()` does nothing. The browser console says the "wallet service" features are not available on the base plan. Which paid plan unlocks export is not established. So: do not put real value in these wallets; players cannot move it out.
- **Wallet Services** (the SDK's built-in wallet screens) are not available, for the same reason.
- **Sessions last one day.** The vendor's pricing page lists longer sessions (up to 30 days) from the Growth plan.
- **Shared monthly count.** The vendor counts "monthly active wallets" per project, so every DGEN game's players count together. Its pricing page (read 23 Nov 2026) says the free plan includes 1,000 a month, bills each one above that, and does not lock players out. If your game will bring many new players, tell the DGEN DAO team first.
- **What does work:** sign-in, the identity token, `eth_accounts`, and signing messages (`personal_sign`), all on Base mainnet.

## What may change, and how to stay safe

DGEN wants each player to have ONE wallet, whichever way they sign in and in every game. That is not decided or scheduled. Two things could reach your game:

1. **A shared account service.** DGEN would tell your server which DGEN account a sign-in belongs to, its wallets, and its one primary wallet. This is the planned direction. If you already keep "a player with several wallets and one primary", moving to it is a lookup.
2. **A one-time change of sign-in wallet addresses.** MetaMask's way of giving one wallet across login methods ("group connections") could give every player a new address. If DGEN ever does that, it will be announced to builders first.

To be ready for both:

- Keep your own player record. Do not use the wallet address as the player's only permanent key.
- For Google and email logins, store the proven email (lower case) next to the wallet. It survives a change of address.
- Store wallets as a list with their login type, and one primary.
- Do not send tokens, NFTs or prizes to a sign-in wallet until the DGEN DAO team says players can get them out.
- Read the Client ID, network and accepted logins from one place in your code, so a change is one edit.

## Checklist for a new game

1. Ask the DGEN DAO team to allow your domains. Check with the `curl` above.
2. Use the Client ID, `sapphire_mainnet` and Base exactly as above, and the settings from an example. No `uiConfig`, no `farcaster`.
3. Open your sign-in window in a browser with a wallet extension installed. It must show Google, Discord and email only.
4. Verify the identity token on your server with the rules above (or `verify-identity.mjs`). Accept only Google, email and Discord. Refuse `@wallet.dgendao.com` emails.
5. Keep your own players, with several wallets each (one per login method) and one primary wallet. Use email only for Google and email logins.
6. Ask before reusing a leftover session; end the SDK session on log-out. Expect sessions to end after a day.
7. Before release, sign in on your staging domain with Google, Discord and email, on a computer and on a phone. For one login, confirm the wallet address with the DGEN DAO team: the same login must give the same address in every DGEN game.

## What is in this kit

| Folder | What | How it was checked (24 Nov 2026) |
| --- | --- | --- |
| `examples/nextjs/` | A small Next.js (App Router) app: provider, sign-in page, and the `/api/session` route that verifies the player | Installed from its lock file, type-checked, built and run. Sign-in window opened with wallet extensions present: Google, Discord and email only. The route refuses bad JSON, a missing token and a forged token |
| `examples/html/` | A plain HTML/JS sign-in page, bundled with Vite | Installed from its lock file, built and run. Same window check, same result |
| `examples/node-verifier/` | Token verification in plain JavaScript (`verify-identity.mjs`), its tests (`test.mjs`), and a tiny Node server (`server.mjs`) | `npm test`: 29 checks pass. The server refuses bad JSON and a forged token |

To run one:

```
cd examples/node-verifier
npm ci
npm test            # 29 checks; needs the internet for one of them
npm start           # http://localhost:8787/api/session
```

```
cd examples/html
npm ci
npm run dev         # http://localhost:5173
```

```
cd examples/nextjs
npm ci
npm run dev         # http://localhost:3000/signin
```

Use `npm ci`, not `npm install`: it installs exactly the package versions these were tested with. `examples/nextjs/lib/verify-identity.mjs` is an identical copy of `examples/node-verifier/verify-identity.mjs`, so the Next.js example runs on its own; copy the file into your project the same way. On localhost the sign-in window opens but a sign-in cannot be completed (see "Local development").

Not checked with these examples: a completed sign-in (it needs an allowed domain), and anything on a real phone.
