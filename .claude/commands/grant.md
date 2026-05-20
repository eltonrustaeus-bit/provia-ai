---
description: Ändra roll för en användare. Användning: /grant email@exempel.com premium
---

Ändra rollen för en användare i ProviaAI:s Supabase-databas.

Argument: $ARGUMENTS
Förväntat format: `email roll` (t.ex. `test@gmail.com premium`)

Giltiga roller: gratis, basic, premium, admin

Steg:
1. Parsa email och roll från argumenten
2. Validera att rollen är giltig
3. Kör denna SQL via Supabase Management API (projekt: mnmotdluigzeehdjbhbu):
```sql
UPDATE profiles p
SET role = '<roll>'
FROM auth.users au
WHERE au.id = p.id AND au.email = '<email>'
RETURNING au.email, p.role;
```
4. Bekräfta ändringen med vad som uppdaterades.
