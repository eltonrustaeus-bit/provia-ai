---
description: Committa och pusha alla ändringar till GitHub så Vercel deployar
---

Committa och pusha alla lokala ändringar i ProviaAI-projektet till GitHub.

Steg:
1. Kör `git status` för att se vad som ändrats
2. Om inga ändringar finns, meddela användaren
3. Kör `git diff --stat` för en snabb översikt
4. Staged alla relevanta filer (undvik .env, node_modules, supabase/.temp)
5. Skapa ett beskrivande commit-meddelande baserat på ändringarna
6. Pusha till `origin main`
7. Bekräfta att pushen lyckades — Vercel deployar automatiskt

Arbetskatalogens sökväg: C:\Users\elton\Desktop\ProvKlarUF
