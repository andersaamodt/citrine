# Citrine

Citrine is a small browser Nostr helper library for Wizardry-family hosted web
apps. It extracts the reusable signer mechanics learned from Gazeta and
Pieplate without taking over either product's account model or UI.

Current scope:

- NIP-46 pairing URI generation.
- NIP-46 relay/RPC client helpers with signer/account pubkey separation.
- Timed-out `get_public_key` retry after mobile signer pairing.
- NIP-07 signer helpers.
- Shared browser/phone signer facade for site UI that needs `signEvent` and
  `getPublicKey`.
- Shared auth challenge signing for Nostr login flows.
- Hex/npub public key normalization.
- Return-from-signer refresh binding for `pageshow`, `focus`, and visibility.
- NIP-55 Android signer callback and URI helpers.
- Shared Nostr login dialog markup and app recommendations.
- NIP-57 zap protocol helpers for LNURL metadata, zap request templates,
  signed zap requests, and invoice callbacks.
- Headless zap flow helpers for WebLN payment and invoice copy behavior.

Out of scope:

- Server login challenge policy.
- Admin/session/CSRF behavior.
- Product-specific account layout, modal triggers, zap amount UI, payment UI,
  and site relay defaults.
- Durable account recovery or private-key storage.

Validate with:

```sh
sh .tests/test-citrine.sh
```

## Runtime API

Use lowercase `citrine` in browser consumers:

```js
window.citrine.nostr.getNip07Signer(window);
window.citrine.zaps.createZapInvoice({ lud16: 'name@example.com', sats: 21 });
window.citrine.web.ensureNostrLoginDialog(document);
```

The CommonJS export has the same shape. Flat helper methods and the browser
globals `window.Citrine` and `window.CitrineNostrWeb` remain compatibility
aliases, but new consumers should use `citrine.nostr`, `citrine.zaps`, and
`citrine.web`.
