# nostr-tools Substrate Audit

Date: 2026-06-22

## Decision

Do not replace Citrine internals with `nostr-tools` in this pass.

Citrine already uses `nostr-tools` as its crypto/relay substrate where the
behavior is large enough to justify delegation: `createNip46Client` accepts a
`NostrTools` object and delegates key generation, public-key derivation,
NIP-04/NIP-44 encryption, event finalization, relay pooling, publishing, and
subscriptions to that object.

No remaining internal primitive can be replaced with the currently deployed
`nostr-tools@2.7.2` browser bundle while proving both smaller Citrine code and
identical behavior.

## Findings

- NIP-46 crypto and relay work is already delegated through the host-provided
  `NostrTools` object.
- Citrine's hex helpers are small public utilities and glue for the
  `NostrTools` APIs. Replacing them would not remove the public API or reduce
  meaningful maintenance.
- `nostr-tools.nip19.encodeBytes('lnurl', bytes)` produces the same LNURL
  Bech32 output as Citrine's encoder for the checked fixture, but requiring it
  would make unsigned zap invoice creation depend on `NostrTools` being loaded.
  That is not identical behavior because copyable Lightning invoice fallback
  should work independently from signer-tool readiness.
- `nostr-tools.nip57.makeZapRequest` in the deployed bundle builds a simpler
  request with `p`, `amount`, `relays`, and optional `e`. Citrine's zap request
  helper also includes the LNURL tag and supports address/kind targets through
  `a` and `k` tags. Replacing it would drop behavior.

## Rule

Future substitutions are acceptable only when all are true:

- Citrine's public API remains unchanged.
- Unsigned zap invoice creation still works without signer tools loaded.
- Existing NIP-46 connect-ack and timed-out `get_public_key` retry behavior is
  preserved.
- The replacement removes code or maintenance burden rather than adding a
  second internal path.
- Citrine tests cover equivalence for the substituted behavior.
