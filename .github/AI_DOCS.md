# Citrine AI Notes

## Standards

- Citrine follows Wizardry-family source-only repo hygiene.
- Browser JavaScript is an approved boundary because Citrine is a browser
  Nostr helper library.
- POSIX `sh` owns validation entrypoints.
- Node is used only by `.tests/test-citrine.sh` to execute JavaScript unit
  tests; no package manager, dependency cache, or build output belongs here.
- Test output must stay in `${TMPDIR:-/tmp}` or process output, not the repo.
- Follow `.github/NOSTR_TOOLS_AUDIT.md` before replacing Citrine internals with
  `nostr-tools` helpers.

## Scope

- Keep reusable NIP-46, NIP-07, login dialog, signer facade, and NIP-57 zap
  protocol mechanics here.
- Keep Gazeta and Pieplate product policy in their own repos.
- Do not add app-specific UI, account creation, admin authorization, draft sync,
  or site deployment behavior.

## Lessons

- Nostr login flow copy should be signer-neutral unless an explicit
  recommendation surface names a specific app.
- After a NIP-46 connect ack, retry timed-out `get_public_key` requests because
  mobile signer relay listeners may need a short settle window.
- Custom-protocol signer launches should happen from a prepared user action;
  if setup is still async, make the next tap explicit.
- Zap UI can stay site-specific, but LNURL resolution, Bech32 LNURL encoding,
  NIP-57 zap request construction, and callback invoice requests are shared
  protocol work and belong in Citrine.
