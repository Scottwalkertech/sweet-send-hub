
# Move Treasury Operator to Supabase (Auth + Realtime)

Everything admin-editable and every field the console mutates on a user moves to Supabase. The client dashboard subscribes to `postgres_changes` so admin edits appear live for signed-in customers.

Out of scope this pass (stay in `mt-store` localStorage): transaction ledger, pending transfer queue, chat threads. These can be migrated in a follow-up.

## 1. Enable Lovable Cloud + Supabase Auth

- Enable Cloud.
- Auth: email + password (default) and Google sign-in.
- Add an admin login form at `/admin/login` (public route). The hidden 5-tap / Ctrl+Shift+A gesture still routes to `/admin`, but the console now requires a signed-in user with `admin` role.

## 2. Schema (single migration)

```
app_role                  enum('admin','customer')
user_roles                (id, user_id -> auth.users, role, unique(user_id, role))
profiles                  mirrors MtUser fields the admin edits
  (id -> auth.users, name, email, phone, address, tier, status,
   verified, debit_frozen, daily_limit, balance, savings_balance,
   account_number, savings_account_number, profile_picture, created_at)
system_settings           key/value singleton table
  (key text pk, value jsonb, updated_at)
  seeded keys:
    'deposit'         -> DepositSettings (bank name, routing, BTC, QR, etc.)
    'rates'           -> { checking_apy, savings_apy }
    'limits'          -> { default_daily_limit, wire_cutoff }
    'banner'          -> { enabled, tone, message }
```

Grants + RLS:
- `profiles`: owner SELECT/UPDATE on self; admin (via `has_role`) full read/write.
- `system_settings`: SELECT to `authenticated` and `anon` (banner/rates are public); UPDATE only for admin.
- `user_roles`: SELECT own row; admin full access. Role check via `has_role()` security-definer.
- Trigger on `auth.users` insert creates a `profiles` row + `customer` role.

## 3. Data layer

New `src/lib/mt-db.ts` replaces the equivalent parts of `mt-store.ts`:
- `useProfile(userId)`, `useAllProfiles()` (admin), `updateProfile(id, patch)`
- `useSettings(key)`, `updateSetting(key, value)` (admin)
- `useRealtimeTable(table, filter, onChange)` — thin wrapper around `supabase.channel().on('postgres_changes', ...).subscribe()`

`mt-store.ts` keeps ledger/queue/chat only.

## 4. Admin console (`src/routes/admin.tsx`)

Every input and button on the console writes through `updateProfile` / `updateSetting`:
- User row edits (freeze debit, change tier/status, adjust balance, daily limit, verify) → `profiles` UPDATE.
- Deposit settings tab → `system_settings` upsert (`key='deposit'`).
- New "System" tab: interest rates, default limits, global banner text/toggle — all writing to `system_settings`.
- Merchant template injection still writes to local ledger (out of scope).
- Gate the whole route: sign-in required + `has_role('admin')`; unauthorized users get the existing 404 screen. The hidden gesture just sends you to `/admin/login`.

## 5. Client dashboard (`src/routes/index.tsx`, `deposit.tsx`, `transfer.tsx`)

- Read `profile` from Supabase for the signed-in user; fall back to legacy local user only if Cloud isn't set up.
- Read deposit info, rates, and banner from `system_settings`.
- On mount, subscribe:
  ```ts
  supabase.channel('profile:' + userId)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, refetch)
    .subscribe()
  supabase.channel('settings')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, refetch)
    .subscribe()
  ```
- Global banner component in `__root.tsx` renders from `system_settings.banner` and updates live.

## 6. Verification

- Typecheck.
- Playwright: sign in as admin → toggle banner + freeze a user → open a second incognito context as that user → confirm banner appears and dashboard shows "Account frozen" without refresh.

## Notes

- Existing localStorage users are not migrated; the demo starts with a fresh Supabase auth pool. Seed one admin + one customer via SQL so the console isn't empty.
- Ledger/queue/chat realtime is deferred; flagged in code with `// TODO: migrate to Supabase` comments.
