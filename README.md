# Citrine

Citrine is a small browser Nostr helper library for Wizardry-family hosted web
apps. It extracts the reusable signer mechanics learned from Gazeta and
Pieplate without taking over either product's account model or UI.

Current scope:

- NIP-46 pairing URI generation.
- NIP-46 relay/RPC client helpers with signer/account pubkey separation.
- Timed-out `get_public_key` retry after mobile signer pairing.
- NIP-07 signer helpers.
- Return-from-signer refresh binding for `pageshow`, `focus`, and visibility.

Out of scope:

- Server login challenge policy.
- Admin/session/CSRF behavior.
- App-specific copy, recommendations, and layout.
- Durable account recovery or private-key storage.

Validate with:

```sh
sh .tests/test-citrine.sh
```
