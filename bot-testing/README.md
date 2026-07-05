# Provia Bot-testning (syntetisk användartest)

Kör AI-personas genom den live-sajten som riktiga målkunder skulle göra:
skapar konto → använder appen → träffar paywall → återkommer med feedback
i sin egen röst. Fångar **buggar, UX-friktion, oklarheter och konverterings-signal**.

## ⚠️ Vad detta ÄR och INTE är
- ✅ QA + UX-signal: hittar trasiga flöden, console-fel, förvirrande UI, var folk fastnar.
- ❌ INTE marknadsvalidering. En bot vet inte om riktiga elever gillar/betalar.
- ❌ Presentera ALDRIG dessa konton som riktiga användare för jury/investerare. Det är vilseledande.

## Krav
- `.env.local` med `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (finns redan).
- Playwright-browsers: `npx playwright install chromium`

## Kör
```bash
node bot-testing/run-bots.mjs                    # alla personas, headless, mot proviaai.se
node bot-testing/run-bots.mjs --headed           # se webbläsaren live
node bot-testing/run-bots.mjs --only=liam_korkort # bara en persona
node bot-testing/run-bots.mjs --base=http://localhost:3000  # mot lokal/staging
```

Rapport hamnar i `bot-testing/reports/<timestamp>/`:
- `REPORT.md` — sammanfattning, rankade buggar, friktion, konvertering, citat
- `raw-results.json` — allt rådata
- `*.png` — skärmdumpar per persona/steg

## Konton + mail
- Konton skapas med plus-adressering: `elton.rustaeus+proviabot_<id>_<ts>@gmail.com`.
  Alla välkomstmail + admin-notiser landar i din inbox. Byt bas med `BOT_EMAIL_BASE`.
- Varje körning skickar ~2 mail/persona (välkomst + admin-notis). 6 personas = ~12 mail.

## Städa efteråt
```bash
node bot-testing/cleanup.mjs           # visar vilka konton som skulle raderas
node bot-testing/cleanup.mjs --delete  # raderar alla +proviabot_-konton
```

## Personas
Redigera `personas.json`. Varje persona har `journey` (vilka sidor den besöker):
`signup`, `app`, `korkortet`, `forbattring`, `larare`, `pricing`.

## Tolka resultaten — känt brus
Vissa "buggar" i rapporten är test-artefakter, inte prod-fel. Verifiera alltid mot prod innan du agerar:
- **`generate-exam` 400 medan noten säger "prov genererades"** — boten dubbel-submittar (robustClick + snabb wizard). Genereringen lyckas ändå. Inte prod-bug.
- **`förbättring.html` 404 på localhost** — `vercel dev` serverar inte ö-filnamn korrekt. Live prod = 200. Endast lokalt brus.
- **`api/check-role` `net::ERR_ABORTED` på pricing** — boten navigerar bort medan fetchen pågår. Inte prod-bug.
- **Låga betyg (1–2/5) speglar ofta att boten inte slutförde kärnflödet**, inte att appen är dålig. Läs alltid step-`note` i `raw-results.json`.

Tumregel: ett fynd är äkta först när det syns i step-`note` ELLER reproduceras mot prod-URL:en.

## Gräns mot betalning
Botten stannar vid paywall/pricing — den slutför **aldrig** ett Stripe-köp.
