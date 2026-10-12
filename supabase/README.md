# Backend setup (Supabase)

The planner works without this. The board, publishing, 1v1, and GitHub sign-in
need a Supabase project. Setup takes about 10 minutes and the free tier is enough.

## 1. Create the project
1. Go to https://supabase.com, sign in, and click **New project**.
2. Pick any name and region, and save the database password somewhere safe (the app never needs it).

## 2. Create the tables
1. In the project, open **SQL Editor** → **New query**.
2. Paste everything from `migrations/20261011000000_board_and_1v1.sql` and click **Run**.
   It should finish with "Success. No rows returned".

## 3. Turn on GitHub sign-in
1. In Supabase: **Authentication** → **Sign In / Providers** → **GitHub**. Copy the **Callback URL**
   shown there (it looks like `https://<project-ref>.supabase.co/auth/v1/callback`).
2. On GitHub: **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**.
   - Homepage URL: `http://localhost:5173`
   - Authorization callback URL: the Callback URL from step 1
3. Register it, then copy the **Client ID** and click **Generate a new client secret**.
4. Back in Supabase, turn GitHub on, paste the Client ID and Client Secret, and **Save**.
   (The client secret lives only in Supabase. Never put it in this repo.)
5. **Authentication** → **URL Configuration**:
   - Site URL: `http://localhost:5173`
   - Redirect URLs: add `http://localhost:5173/**`

## 4. Connect the app
1. In Supabase: **Project Settings** → **API Keys**. Copy the **Project URL** and the
   **publishable** key (`sb_publishable_...`).
2. In the repo: `cp .env.example .env.local` and paste both values in.
   Use the publishable key only. The **secret** key must never go in the app
   (`npm run check-secrets` blocks commits that contain it).
3. Restart `npm run dev`. "Sign in with GitHub" appears in the header and the Board fills in.

## How it fits together
- `profiles`: one per GitHub sign-in, created automatically.
- `setups`: published setups (title, description, up to 5 tags, the desk as JSON, a thumbnail
  path, and points). Anyone can read them; only the owner can edit or delete. Points, wins,
  and losses can only change through `cast_vote`.
- `votes`: 1v1 results. Only reachable through two functions:
  - `get_matchup(filter_tags, anon_key)`: two random setups sharing a tag, close in points, never
    your own, never a pair you already voted on.
  - `cast_vote(winner, loser, anon_key)`: anyone can vote (signed-out voters are identified by a
    random id kept in their browser). One vote per pair per voter, rate-limited per voter and per
    IP. Points move Elo-style (everyone starts at 1000, and an upset earns more).
- Storage bucket `thumbnails`: public images, each user can only upload into their own folder.

To change the schema later, add a new file in `migrations/` rather than editing this one.
