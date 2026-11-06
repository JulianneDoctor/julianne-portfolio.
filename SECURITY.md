# Security implementation and boundaries

This project reduces common risks; no website can be guaranteed immune to attacks. It is database-ready source code, not a configured or audited production service.

## Implemented controls

- Private inquiries have no anonymous table privileges. Anonymous users cannot read, directly insert, update, or delete them.
- Only approved Auth user UUIDs can read/change inquiries or update public content, and PostgreSQL Row Level Security requires the JWT's `aal2` claim. MFA is enforced in database policy, not just browser UI.
- Admin allowlist and submission counters live in an unexposed `private` schema. Users cannot grant themselves membership. Removing membership blocks new database operations even with an otherwise valid token.
- Privileged SQL functions use fixed SQL, fixed empty search paths, explicit schema names, and explicit execute grants. The submission RPC is executable only by `service_role`.
- The public contact handler validates strings, consent, lengths, actual streamed body size, JSON type, honeypot, and request method before saving. It requires server-side Turnstile verification with exact hostname and action checks. There is no test-token bypass in the handler.
- Exact CORS origins are checked. CORS is not authentication and does not replace Turnstile or database permissions; non-browser clients can forge Origin headers.
- Successful submissions are limited atomically to 3 per normalized email per clock hour and 100 site-wide per clock hour. A transaction-scoped PostgreSQL lock prevents parallel function instances from bypassing the counters. No raw IP is added to the application's inquiry table. Email digests are keyed with a server secret.
- Old rate counters are pruned on subsequent successful-verification submission attempts, not by a continuous scheduled job.
- Saved portfolio text and message bodies are rendered using `textContent` and form values, not `innerHTML`. User-supplied links permit only HTTPS URLs without embedded credentials.
- Admin sessions stay in memory (`persistSession: false`), with no tokens stored in localStorage. Refreshing requires login again. A 15-minute inactivity lock clears displayed private data and signs out locally. This browser lock does not itself revoke already copied JWTs; configure provider token lifetimes/session controls appropriately.
- Public configuration accepts only modern publishable keys, rejecting known secret-key formats for use. This does not make it safe to place a secret in the file: a secret committed publicly is already disclosed, even if client code rejects it.
- The database stores managed Auth identities, not application-managed plaintext passwords. The dashboard does not create public accounts, log passwords, or implement password-reset/MFA bypasses.
- HTML includes restrictive Content Security Policies. The optional `_headers` adds anti-framing and other response headers on supporting hosts. GitHub Pages does not honor `_headers`; meta CSP cannot provide `frame-ancestors` protection.
- The Supabase browser SDK is vendored from an official pinned npm release; its tarball integrity was checked against registry metadata. Secrets, challenge tokens, and message bodies are not logged by application code. Hosting/provider logs have their own policies.
- Public saves use the last known `updated_at` as a precondition to reduce accidental overwrites from simultaneous admin tabs.

## Still required before production

- Create and configure your own Supabase project, run migration/seed, create your Auth user, and add its UUID to the private allowlist.
- Disable public signups; enable TOTP enrollment/verification; use strong unique passwords. Protect provider owner and GitHub accounts separately with MFA. Perform your first authenticator enrollment in a trusted environment before publishing the site.
- Set Turnstile production keys, exact origins, and the server-only hash secret. Never commit service-role keys or use a test widget on the public website.
- Deploy the public contact function with its gateway JWT verification setting as documented. The function's anti-abuse checks replace the need for a visitor login, while database/admin authorization is unchanged.
- Enable HTTPS, choose a host that supports the security headers you need, and verify the effective headers on the live domain. Review provider logs/alerts and quotas. The included code is not a DDoS protection service.
- Configure backups, suitable data region/retention, and a tested restore process. No backup scheduler or automatic inquiry deletion is included. Delete inquiries when no longer needed and account for provider backup retention.
- Keep dependencies and provider settings current. The SDK is pinned, not automatically patched.
- Test the configured live system using the acceptance list in SETUP-DATABASE.md before collecting real inquiries. No live account, backend connection, production access test, or penetration test has been completed by generating these files.

## Test scope

- 52 automated checks: validation, malformed/oversized requests, exact origins, missing consent, bot challenge failures, hostname/action mismatches, rate-limit responses, failure-closed behavior, secret-safe errors, URL/config safety, and browser JavaScript syntax.
- 25 checks against actual PostgreSQL using temporary PGlite: migration/seed, anonymous access denial, allowed public reads, private table access, MFA claim checks, non-admin denial, status-only update permissions, restricted service RPC, successful contact inserts, per-email/site-wide counters, deletion authorization, and immediate allowlist revocation.
- PostgreSQL tests simulate verified Auth JWT claims. They do not verify Supabase's production Auth/JWT gateway, real MFA enrollment, real Turnstile service, distributed traffic behavior, or live provider configuration.

Useful references: [OWASP authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [database security](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html), [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Turnstile server checks](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
