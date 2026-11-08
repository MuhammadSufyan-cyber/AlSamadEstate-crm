# Al Samad Estate CRM

Lead intake for consultants and a control center for admins. Built with Next.js, Tailwind CSS and Supabase.

- **Consultants** sign in, fill in the intake form, and see only the form.
- **Admins** see every lead: filters, status changes, audit trail, CSV export, and consultant accounts.
- Budgets are in PKR (shown as Lac / Cr).

## 1. Set up Supabase (once, one person)

1. Create a Supabase project.
2. Open **SQL Editor**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql) and run it.
3. **Authentication > Users > Add user**: add the first admin (tick *Auto Confirm User*).
4. Make that user an admin by running this in the SQL Editor, with their email:
   ```sql
   update public.profiles set role = 'admin' where email = 'admin@example.com';
   ```
5. **Authentication > Sign In / Providers**: leave Email on. Turn **off** "Allow new users to sign up" so only the admin can create accounts.

## 2. Run it on your computer (each developer)

```bash
npm install
cp .env.example .env.local   # then fill in the three values
npm run dev
```

Open http://localhost:3000. Get the values from Supabase **Project Settings > API**:

| Variable | Where it comes from | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key | No |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key | **Yes. Never commit or share.** |

`.env.local` is ignored by git. Each developer keeps their own copy.

## 3. Working together on GitHub

- Never push straight to `main`. Make a branch (`git switch -c feature/short-name`), commit, push, and open a pull request.
- Run `git pull` on `main` before starting new work.
- Run `npm run lint` and `npm run build` before opening a pull request.

## 4. Deploy on Vercel

1. Vercel > **Add New > Project** > import this GitHub repo.
2. Add the three environment variables above (Settings > Environment Variables).
3. Deploy. In Supabase **Authentication > URL Configuration**, set the Site URL to your Vercel address.

## How access is enforced

All security rules live in the database ([`supabase/schema.sql`](supabase/schema.sql)) as row level security, so they hold even if someone bypasses the website. A consultant can only add and read their own leads. Only admins can read all leads, change them, read the audit log, or manage accounts. Every change to a lead is written to the audit log by a database trigger.

## Not built yet

Inline editing of columns other than status, the custom-fields manager (`custom_fields_config` from the PRD), and the budget range slider.
