# PNHS Online Voting System

Web-based voting system for **Polanco National High School** Supreme Secondary Learner
Government (SSLG) elections. React frontend + Supabase (PostgreSQL, Auth, Storage).

## What's in here

```
supabase/
  migrations/        SQL: schema, RLS, secure functions, seed positions
  functions/
    import-roster/   Edge Function: bulk-create voter accounts from CSV
src/                 React app (Vite)
  context/           LRN/email auth
  pages/             Login, Ballot, Results
  pages/admin/       Admin dashboard + tabs
  styles/theme.css   Regal-blue serif branding, mobile-first
```

## 1. Create the Supabase project

1. Create a free project at https://supabase.com.
2. In **SQL Editor**, run the four migration files **in order**:
   `0001_schema.sql`, `0002_rls.sql`, `0003_functions.sql`, `0004_seed.sql`.
3. **Storage** → create a **public** bucket named `candidate-photos`.
4. **Project Settings → API**: copy the `Project URL` and the `anon` public key.

## 2. Create the first admin

1. **Authentication → Users → Add user**: create the committee account
   (real email + strong password). Confirm the email.
2. Copy that user's UUID, then in **SQL Editor**:
   ```sql
   insert into public.admin_users (id, email)
   values ('PASTE-USER-UUID', 'committee@school.email');
   ```

## 3. Deploy the Edge Function

Install the Supabase CLI, then:
```bash
supabase functions deploy import-roster --project-ref YOUR_REF
```
The function uses `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`,
which Supabase injects automatically.

## 4. Run / deploy the frontend

```bash
cp .env.example .env.local      # fill in URL + anon key + temp password
npm install
npm run dev                     # local dev
npm run build                   # production build -> dist/
```

Deploy `dist/` (or the repo) to **Vercel** or **Netlify** (free tier). Set the same
env vars in the host's dashboard. Add a SPA rewrite so client routes work:
- Netlify: `_redirects` file with `/*  /index.html  200`
- Vercel: framework preset "Vite" handles this automatically.

## 5. Run the election

1. Log in at `/admin/login`.
2. **Election Settings** — set title + open/close date-time.
3. **Ballot Setup** — review seeded positions; add parties + candidates (with photos).
4. **Voters / Roster** — upload the CSV (`lrn, full_name, grade_level, section`).
   Every student gets the shared temporary password from `.env`.
5. Students vote at the public URL during the window.
6. **Turnout** — watch live participation by grade and section.
7. After close: **Results & Export** for CSV/PDF, then **Overview → Publish Results**.

## Security notes
- Browser uses only the `anon` key; **Row-Level Security** is the gatekeeper.
- Votes are written only through the `cast_ballot` function (atomic, window-checked,
  one-ballot-per-student). The `votes` table has **no public read access** — tallies
  come from `SECURITY DEFINER` functions only.
- The `service_role` key lives only inside the Edge Function, never in the browser.
- Ballot secrecy is operational: votes carry a `voter_id` solely to enable the
  **Reset Ballot** dispute tool; no screen or report ever links a vote to a person.
  Every reset is written to `ballot_reset_log`.

## CSV format for the roster
```csv
lrn,full_name,grade_level,section
136750120001,Juan Dela Cruz,12,Rizal
136750120002,Maria Santos,11,Mabini
```
