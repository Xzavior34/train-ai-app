# Deploying the backend to Supabase

This project doesn't ship a live backend - Supabase projects are tied to your
own account, and creating one isn't something that can be done on your
behalf. Here's how to stand it up yourself, in either order of preference.

## Option A - Supabase CLI (recommended)

1. Install the CLI: https://supabase.com/docs/guides/cli
2. Create a project at https://supabase.com/dashboard (free tier is enough
   to run everything here).
3. From this folder:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   This applies every file in `supabase/migrations/` in order.
4. Optionally seed sample data:
   ```bash
   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" -f supabase/seed.sql
   ```
   (or paste `supabase/seed.sql` into the Supabase SQL editor). Note: the
   seed file assumes matching `auth.users` rows already exist for the
   sample UUIDs - create those people via Authentication → Users → Add user
   in the dashboard first, using the same UUIDs, or edit the seed file to
   use real UUIDs from users you've already created.

## Option B - SQL editor (no CLI)

Open your project's SQL editor (Dashboard → SQL Editor) and run each file in
`supabase/migrations/` **in filename order** (0001, 0002, 0003, 0004, 0005,
0006), each as its own query. Then optionally run `supabase/seed.sql`.

## Connecting the frontend

1. Copy `.env.example` to `.env.local`.
2. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from
   Project Settings → API in your Supabase dashboard.
3. Install the client library: `npm install @supabase/supabase-js`
4. Create a client (e.g. `src/lib/supabaseClient.js`):
   ```js
   import { createClient } from "@supabase/supabase-js";
   export const supabase = createClient(
     import.meta.env.VITE_SUPABASE_URL,
     import.meta.env.VITE_SUPABASE_ANON_KEY
   );
   ```
5. The four `*App.jsx` files currently use in-memory mock data (arrays at the
   top of each file). Wiring them to Supabase means replacing those constants
   with `supabase.from('table').select()` / `supabase.rpc('function_name')`
   calls inside `useEffect`. This is a real, non-trivial integration step - not something that happens automatically by adding the schema.

## What's actually in the schema

See `SECURITY.md` for the authorization model, and the migration files
themselves - every table and function is commented with which part of the
original spec it corresponds to.
