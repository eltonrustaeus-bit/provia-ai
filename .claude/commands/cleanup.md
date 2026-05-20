---
description: Radera alla gratiskonton från ProviaAI:s databas
---

Rensa alla konton med roll='gratis' från ProviaAI:s Supabase-databas (projekt: mnmotdluigzeehdjbhbu).

Steg:
1. Visa först vilka konton som kommer raderas:
```sql
SELECT au.email, p.created_at
FROM auth.users au
JOIN profiles p ON p.id = au.id
WHERE p.role = 'gratis';
```
2. Om inga gratiskonton finns, meddela användaren
3. Om det finns konton — visa listan och be om bekräftelse innan du raderar
4. Vid bekräftelse, kör:
```sql
DELETE FROM auth.users au
USING profiles p
WHERE p.id = au.id AND p.role = 'gratis'
RETURNING au.email;
```
5. Bekräfta hur många som raderades
