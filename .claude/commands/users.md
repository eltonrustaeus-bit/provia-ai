---
description: Visa alla registrerade användare på ProviaAI med email, roll och registreringsdatum
---

Hämta och visa alla registrerade användare i ProviaAI:s Supabase-databas (projekt: mnmotdluigzeehdjbhbu).

Kör denna SQL-fråga via Supabase Management API (access token finns i minnet):
```sql
SELECT au.email, p.role, p.approved, p.created_at
FROM auth.users au
JOIN profiles p ON p.id = au.id
ORDER BY p.created_at DESC;
```

Presentera resultatet som en tydlig tabell med kolumnerna: Email, Roll, Registrerad.
Ange även totalt antal användare längst ned.
