# citrine

citrine is a dependency-free browser helper library for Nostr login and zap
flows in Wizardry-family hosted web apps. It holds reusable Nostr and Lightning
protocol mechanics without taking over a site's account model, authorization
policy, persistence policy, or product UI.

The runtime API is intentionally small:

```js
window.citrine.nostr
window.citrine.zaps
window.citrine.web
```

There are no uppercase globals, legacy aliases, or flat helper exports. In
CommonJS tests or tooling, `require('./src/citrine-nostr-web.js')` returns the
same `{ nostr, zaps, web }` object.

## What Belongs Here

citrine owns reusable browser Nostr and zap helpers:

- NIP-07 browser signer detection.
- NIP-46 Nostr Connect pairing, relay/RPC helpers, signer/account pubkey
  separation, and timed-out account-pubkey retry after pairing.
- NIP-55 Android signer callback URL and URI helpers.
- Nostr auth event template creation and signing.
- Public key normalization for hex and optional `npub`.
- Shared browser/phone signer facade for UI that needs `getPublicKey` and
  `signEvent`.
- Shared Nostr login dialog markup, signer-neutral login copy, and app
  recommendations.
- NIP-57 zap mechanics: LNURL metadata lookup, zap request templates, signed
  zap requests, callback invoice requests, WebLN payment, and clipboard copy.

citrine does not own site-specific behavior:

- Server challenge issuance, session, CSRF, admin, or permission policy.
- Site-specific relay defaults, app metadata, route handling, or deployment.
- Product account layout, modal triggers, amount presets, zap payment UI, or
  content workflows.
- Durable private-key storage or account recovery.

## Install

Vendor `src/citrine-nostr-web.js` into the consuming site's tracked source tree
and load it before code that uses `window.citrine`.

```html
<script src="/static/vendor/citrine-nostr-web.js"></script>
<script src="/static/nav-auth.js"></script>
```

For NIP-46 relay work, the host page must also provide a compatible
`window.NostrTools` bundle. citrine deliberately does not include or install
that dependency.

## Quick Start

Browser signer login:

```js
var signer = window.citrine.nostr.getNip07Signer(window);
var signed = await window.citrine.nostr.signAuthChallenge(signer, {
  challenge: challenge.challenge,
  domain: window.location.host,
  origin: window.location.origin,
  content: 'Login'
});
```

Phone signer pairing:

```js
var tools = await window.citrine.nostr.waitForNostrTools({ target: window });
var client = window.citrine.nostr.createNip46Client({
  nostrTools: tools,
  relays: ['wss://relay.example'],
  storage: window.citrine.nostr.createSessionStorageAdapter(sessionStorage, 'my-app.nip46')
});

await client.ensurePairing();
client.subscribe();
var uri = client.currentUri({
  name: 'My App',
  metadata: { name: 'My App', url: window.location.origin },
  perms: 'get_public_key,sign_event:22242'
});
```

Shared login dialog:

```js
window.citrine.web.ensureNostrLoginDialog(document, { title: 'Sign in' });
window.citrine.web.renderNostrRecommendations({
  tab: 'phone',
  flavor: 'android',
  loginSummary: document.getElementById('auth-login-summary'),
  loginNote: document.getElementById('auth-login-note'),
  loginApps: document.getElementById('auth-login-apps'),
  zapSummary: document.getElementById('auth-zap-summary'),
  zapNote: document.getElementById('auth-zap-note'),
  zapApps: document.getElementById('auth-zap-apps')
});
```

Zap invoice creation:

```js
var result = await window.citrine.zaps.createZapInvoice({
  lud16: 'alice@example.com',
  sats: 21,
  note: 'Nice post',
  signer: signer,
  zapConfig: { relays: ['wss://relay.example'] },
  target: { eventId: eventId, kind: 30023 }
});
```

## API Reference

### `citrine.nostr`

`NIP46_KIND`
: Nostr Connect event kind, `24133`.

`DEFAULT_RETRY_DELAYS`
: Default retry delays in milliseconds for timed-out mobile signer
  account-pubkey lookup: `[1200, 2400, 4800]`.

`normalizePubkeyHex(value)`
: Returns a lowercase 64-character hex pubkey or `''`.

`normalizeNostrPubkey(value, tools)`
: Accepts a hex pubkey or, when `tools.nip19.decode` is provided, an `npub`.
  Returns lowercase hex or `''`.

`bytesToHex(bytes)` / `hexToBytes(hex)` / `randomHex(bytes, randomSource)`
: Small byte/hex utilities used by the NIP-46 client. `randomHex` prefers
  `crypto.getRandomValues` and falls back to `Math.random` only when crypto is
  unavailable.

`buildNostrConnectUri(options)`
: Builds a `nostrconnect://` URI. Requires `appPubkey` and `pairSecret`.
  Accepts `relays`, `name`, `metadata`, and `perms`.

`extractConnectSecret(msg)`
: Extracts a Nostr Connect secret from known signer response shapes.

`isConnectAck(msg, launchPending)`
: Returns true for signer connect acknowledgements, including empty-result
  acknowledgements immediately after launching a native signer.

`createAuthEventTemplate(options)`
: Builds an unsigned auth event. Accepts `kind`, `challenge`, `action`,
  `pubkey`, `origin`, `domain` or `host`, `url`, `method`, `content`,
  `createdAt`, and `extraTags`.

`signAuthChallenge(signer, options)`
: Gets the active signer pubkey, builds an auth event template, asks the signer
  to sign it, and resolves `{ pubkey, event }`.

`withTimedOutRetry(task, options)`
: Retries `task` only when the thrown error message contains `timed out`.
  Accepts `delays`, `wait`, and `onRetry`.

`createSessionStorageAdapter(storage, key)`
: Returns `{ load, save, clear }` backed by `sessionStorage` or a supplied
  compatible storage object.

`createMemoryStorageAdapter(initial)`
: Returns an in-memory `{ load, save, clear }` adapter for tests or ephemeral
  sessions.

`hasNostrTools(target)`
: Checks whether `target.NostrTools` has the substrate needed by citrine's
  NIP-46 client.

`waitForNostrTools(options)`
: Waits for `target.NostrTools`. Accepts `target`, `document`, `timeoutMs`,
  `intervalMs`, `scriptSrc`, and `errorMessage`. If `scriptSrc` is provided,
  citrine appends one script tag marked `data-citrine-nostr-tools="true"`.

`createNip46Client(options)`
: Creates a Nostr Connect client. Accepts `nostrTools`, `relays`,
  `defaultRelays`, `storage`, `name`, `metadata`, `perms`, `retryDelays`,
  `wait`, `onStatus`, `nowEpoch`, `randomHex`, and optional test hook
  `rpcRequest`.

The returned client exposes:

- `state()`
- `ensurePairing()`
- `currentUri(uriOptions)`
- `setLaunchPending(value)`
- `subscribe(lookbackSeconds)`
- `handleRelayEvent(event)`
- `sendRpc(method, params, timeoutMs)`
- `getAccountPubkey(options)`
- `getAccountPubkeyWithRetry(options)`
- `resetPairing(options)`
- `clear()`
- `save()`
- `load()`

`getNip07Signer(target)`
: Returns `target.nostr` after verifying `getPublicKey` and `signEvent`, or
  throws a clear error.

`createSharedNostrSigner(options)`
: Creates a facade that prefers a NIP-07 browser signer and falls back to a
  paired NIP-46 client. Accepts `target`, `nip46Client`,
  `ensureNip46Ready`, `getLastPubkey`, and `unavailableMessage`. Returns an
  object with `resolve`, `signEvent`, `getPublicKey`, and `getStatus`.

`classifySignerError(err)` / `signerUnavailableError(err)`
: Classifies signer errors as `rejected`, `timeout`, `decrypt`,
  `invalid_pubkey`, `locked`, `pairing`, `missing`, `approval_required`, or
  `unknown`, and identifies unavailable-signer cases.

`signerIsAvailable(api)`
: Resolves whether a shared signer facade is currently available.

`bindSignerReturnRefresh(target, refresh)`
: Calls `refresh(reason)` on `pageshow`, `focus`, and visible
  `visibilitychange`. Returns an unbind function.

`cleanNip55CallbackUrl(rawUrl)`
: Removes NIP-55 callback result parameters from a URL.

`buildNip55CallbackUrl(rawUrl, resultParam)`
: Builds a hash-fragment callback URL suitable for Android NIP-55 signers.

`buildNip55Uri(options)`
: Builds a `nostrsigner:` URI. Requires `type`; accepts `params`.

`parseNip55Callback(rawUrl)`
: Parses Android signer callback data and returns
  `{ present, rejected, result, cleanUrl }`.

### `citrine.zaps`

`lud16ToUrl(lud16)`
: Converts `name@domain` into the LNURL-pay metadata URL.

`bech32Encode(hrp, text)`
: Encodes text as Bech32. Used for LNURL values.

`loadLnurlZapInfo(lud16, options)`
: Fetches LNURL metadata, verifies Nostr zap support, and resolves
  `{ payUrl, callback, encodedLnurl, nostrPubkey, minSendable, maxSendable,
  commentAllowed }`. Accepts an optional `fetch` override.

`createZapRequestTemplate(options)`
: Builds an unsigned NIP-57 zap request. Requires `lnurlInfo`; accepts
  `zapConfig.relays`, `target.eventId`, `target.address`, `target.kind`,
  `amountMsats`, `note`, `pubkey`, and `createdAt`.

`createSignedZapRequest(options)`
: Builds and signs a NIP-57 zap request using `options.signer`.

`requestZapInvoice(options)`
: Calls the LNURL callback with `amount`, optional signed `nostr` event, and
  optional unsigned `comment`. Resolves the BOLT11 invoice string.

`createZapInvoice(options)`
: End-to-end helper for LNURL metadata lookup, amount validation, optional
  zap request signing, and invoice request. Accepts `lud16`, `sats` or
  `amountMsats`, `note`, `signer`, `zapConfig`, `target`, and `fetch`.
  Resolves `{ invoice, signed, signedEvent?, lnurlInfo }`.

`payLightningInvoiceWithWebLN(invoice, target)`
: Enables `target.webln` when needed and calls `sendPayment(invoice)`.

`copyTextToClipboard(text, target)`
: Writes text through `target.navigator.clipboard.writeText`.

`createZapFlow(options)`
: Returns a headless zap helper object with `createInvoice`, `payInvoice`,
  `copyInvoice`, and `signerIsAvailable`, merging default options with each
  call.

`nostrZapRecommendation(tabName, flavor)`
: Returns zap app recommendation data for the selected login tab/flavor.

### `citrine.web`

`nostrLoginDialogHtml(options)`
: Returns shared login dialog markup. Accepts `title`.

`ensureNostrLoginDialog(document, options)`
: Inserts the shared login dialog into the document if it is not already
  present, and returns the modal element.

`signInHelperMessage(tabName)`
: Returns signer-neutral sign-in helper copy for browser, phone, or manual
  login tabs.

`recommendationPlatformLabel(tabName, flavor)`
: Returns a human platform label such as `Android`, `iPhone / iPad`,
  `Remote signer`, `Manual login`, or `Desktop`.

`nostrLoginRecommendation(tabName, flavor)`
: Returns login app recommendation data. Android phone login recommends Amber
  while the core login copy remains signer-neutral.

`nostrZapRecommendation(tabName, flavor)`
: Returns zap app recommendation data.

`renderNostrRecommendations(options)`
: Renders login and zap recommendations into supplied DOM elements. Accepts
  `tab`, `flavor`, `loginSummary`, `loginNote`, `loginApps`, `zapSummary`,
  `zapNote`, `zapApps`, and optional `iconAssets`.

`payLightningInvoiceWithWebLN(invoice, target)` and
`copyTextToClipboard(text, target)`
: Web convenience aliases for the same headless helpers exposed under
  `citrine.zaps`.

## Consumer Responsibilities

Sites that use citrine still need to own their own policy:

- Decide which relays, app metadata, and NIP-46 permissions to request.
- Issue and validate server-side login challenges.
- Store sessions, CSRF tokens, usernames, and authorization state.
- Wire modal buttons, toasts, QR rendering, amount presets, and payment UI.
- Preserve any deployment-managed source and vendored citrine file in tracked
  source, not generated build output.

## Validation

Run the citrine test suite with:

```sh
sh .tests/test-citrine.sh
```

The suite checks strict runtime shape, browser global export, auth helpers,
NIP-46 retry behavior, signer facade behavior, NIP-55 callbacks, NIP-57 zap
request/invoice behavior, WebLN/clipboard helpers, and return-from-signer
refresh binding.

## License

citrine is licensed under the Open Wizardry License 3.1. See `LICENSE`.
