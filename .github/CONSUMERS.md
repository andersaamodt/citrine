# Citrine Consumer Plan

## Gazeta

- Keep Gazeta's server challenge, session, CSRF, admin authorization, zap modal
  UI, amount presets, invoice copy/payment UI, and site page prefetch/bootstrap
  in Gazeta.
- Citrine adapter points:
  - `buildNostrConnectUri`
  - `extractConnectSecret`
  - Nostr login dialog and recommendations
  - Nostr tools readiness checks
  - shared browser/phone signer facade
  - NIP-57 zap protocol helpers
  - NIP-46 pending RPC handling
  - `getAccountPubkeyWithRetry`
  - return refresh binding
- Keep Gazeta's broader permission request:
  `get_public_key,sign_event:22242,sign_event:9734,sign_event:7,sign_event:17,sign_event:5`.
- Keep Gazeta's site relay defaults and app metadata in the Gazeta adapter.

## Pieplate

- Keep Pieplate's anonymous-first game flow, draft sync, and compact account UI
  in Pieplate.
- Citrine adapter points:
  - `buildNostrConnectUri`
  - tab-scoped NIP-46 storage adapter
  - `getAccountPubkeyWithRetry`
  - NIP-46 return refresh binding
  - NIP-07 signer validation
- Keep Pieplate's minimal permission request: `get_public_key`.

## Migration Rule

- Adopt Citrine in one app at a time after its current local regression tests
  pass.
- Do not replace product copy or storage policy during the first adoption.
- Add one consumer-side assertion for each Citrine behavior removed from local
  source so regressions stay visible at the app boundary.
