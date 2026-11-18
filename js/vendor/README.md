# Browser vendor bundles

These are fixed browser distributions served from ExGen's origin. Do not
replace them with a moving CDN URL. `tests/frontend/vendor-script-boundary.test.mjs`
pins their SHA-256 bytes and checks that the app's HTML does not execute remote
scripts. Review version changes, bundled code, licenses and browser behavior
before changing those hashes.

| Local file | Upstream distribution | License |
| --- | --- | --- |
| `supabase-2.106.0.js` | `@supabase/supabase-js@2.106.0/dist/umd/supabase.js` from npm | MIT; `licenses/supabase-js-LICENSE` |
| `chart-4.4.0.js` | `chart.js@4.4.0/dist/chart.umd.js` from npm | MIT; `licenses/chart-js-LICENSE.md` |
| `gsap-3.12.5.min.js` | `gsap@3.12.5/dist/gsap.min.js` from npm | GreenSock Standard license; notice in file |
| `ScrollTrigger-3.12.5.min.js` | `gsap@3.12.5/dist/ScrollTrigger.min.js` from npm | GreenSock Standard license; notice in file |
| `katex/` | KaTeX `0.19.1/dist` JavaScript, CSS and fonts from npm | MIT; `katex/LICENSE` |
| `vis-network-9.1.6.min.js` | `vis-network@9.1.6/standalone/umd/vis-network.min.js` from the npm tarball; bytes match the previously SRI-pinned unpkg file | Apache-2.0 or MIT; both texts in `licenses/` |

The npm packages are pinned in `package-lock.json` where applicable. The
standalone vis-network file is pinned by its test hash and the existing HTML
SRI. The GSAP notice refers to <https://gsap.com/standard-license/>; check
the terms again before using it outside the current public website.

Serving scripts from the same origin removes the old CDN code-substitution
path while an OAuth URL fragment is present. It does **not** make the current
`localStorage` session immune to first-party XSS, nor replace a full CSP or
the planned Auth/session migration.
