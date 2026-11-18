# ExGen session hardening path — 2026-11-18

This is a technical migration plan, not a claim that the current session is
HttpOnly or that hosted Google login has been retested. The school-pilot
security gate remains open.

## Current boundary verified in source

- `shared.js` starts Google login through the Supabase authorize URL and
  handles an implicit-flow `access_token` and `refresh_token` URL fragment on
  the callback page. It removes the fragment after parsing it, then saves the
  session under `ExGenRuntime.authStorageKey` in `localStorage`.
- `app.html`, `konto.html`, `förbättring.html`, `pricing.html`, `admin.html`,
  `larare.html` and `per.html` use browser-side Supabase clients and/or send
  the bearer token to ExGen APIs. Moving only the token into an HttpOnly cookie
  would break those direct browser calls. Their ownership rules must remain
  effective during any transition.
- Vercel CLI readback on 2026-11-18 identified deployment
  `dpl_29YnNukQdgSSszzQ2WorWDBQYUjX` as READY Preview for Git SHA
  `b07e57f189ff1871753abe31b68ba7cc8f122af8`. That branch serves its
  JavaScript bundles from ExGen's origin. This removes the previous runtime CDN dependency but does not stop a
  first-party XSS from reading browser storage or an OAuth fragment.

## Safe sequence

1. **Preserve the present login while testing a dedicated callback in staging.**
   Use a first-party callback page with no third-party executable code. For
   Google OAuth, configure a staging-only allowed redirect and a PKCE code
   exchange, then strip the one-use code from the URL. Test success, cancel,
   expired code, repeat use, password reset, email verification and an existing
   logged-in tab. Supabase documents that the code verifier must survive on
   the same browser/device and that overlapping flows need special handling.
   Do not switch production Auth settings before this works in staging.
2. **Choose and test the session architecture.** If ExGen keeps direct
   browser-to-Supabase queries, browser JavaScript must retain access to a
   session; use PKCE, a restrictive staged CSP, a reviewed dependency set,
   short session lifetime where available, and cross-tab sign-out controls.
   If the product requires HttpOnly cookies, move every protected browser
   Supabase query and bearer-authenticated API call behind a same-origin server
   boundary first. The server must refresh/rotate the session, use `Secure`,
   `HttpOnly` and appropriate `SameSite` cookies, verify CSRF on state-changing
   routes, and set `Cache-Control: private, no-store` for personal responses.
   This is a coordinated backend migration; `@supabase/ssr` cookie setup alone
   does not make a rich browser app's tokens HttpOnly.
3. **Migrate one complete journey at a time in staging:** login and refresh,
   exam creation/answering/grading/result replay, P.E.R, improvement history,
   account settings, class routes, billing and admin. Keep ownership checks at
   the server/database boundary and reject account switches during in-flight
   requests. Do not silently copy ambiguous legacy browser history to a new
   account.
4. **Prove rollback and remove old storage only after a verified cutover.**
   Existing sessions, password reset links, Google redirects, two-tab races,
   revoked sessions and account deletion need explicit tests. Revoke old refresh
   sessions during final cutover; do not claim local deletion removes data on
   another device or in backups. Roll back by restoring the prior auth route
   only while its old tokens remain valid and access controls still pass.

## Release evidence required

- Two disposable synthetic accounts plus anon: own data works; cross-account
  table/RPC/API reads and writes fail for exams, results, material, P.E.R and
  classes. Use a staging deployment and verified JWTs; local mocks are not
  enough.
- Google PKCE, password login, password recovery, email verification, refresh,
  sign-out, account switching and deletion pass through the actual Preview.
- A CSP report phase shows no blocked legitimate script or network request;
  then an enforcing policy rejects an injected script. Do not use `unsafe-inline`
  as the permanent policy. Verify framing and response headers on the deployed
  build.
- Admin write actions require their own passkey step-up and recovery path.
  A stolen bearer must not be able to enroll an attacker's passkey.

References: [Supabase sessions](https://supabase.com/docs/guides/auth/sessions),
[PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow),
[server-side Auth](https://supabase.com/docs/guides/auth/server-side),
[Google callback](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).
