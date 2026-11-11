# Backend setup (Supabase)

The planner works without this. The board, publishing, 1v1, challenge rooms,
thumbtacks, and signing in (guest or GitHub) need a Supabase project. Setup takes about 10 minutes and the free tier is enough.

## 1. Create the project
1. Go to https://supabase.com, sign in, and click **New project**.
2. Pick any name and region, and save the database password somewhere safe (the app never needs it).

## 2. Create the tables
1. In the project, open **SQL Editor** → **New query**.
2. Paste everything from `migrations/20261011000000_board_and_1v1.sql` and click **Run**.
   It should finish with "Success. No rows returned".
3. New query again: paste `migrations/20261110000000_rooms_guests_tacks.sql` and **Run**.
   (Always run the migrations in order, each one once.)

## 3. Turn on guest sign-in
Friends who open a challenge link play with just a nickname.
1. **Authentication** → **Sign In / Providers** → turn on **Allow anonymous sign-ins** → **Save**.
2. (Recommended) **Authentication** → **Settings** → turn on **Allow manual linking**, so guests can
   keep their account by linking GitHub ("Keep my stuff" in the header).
3. Anonymous sign-ins are rate-limited per IP by Supabase (Authentication → Rate Limits); the default
   is plenty for friends. Turn on CAPTCHA there if strangers start abusing it.

## 4. Turn on GitHub sign-in
1. In Supabase: **Authentication** → **Sign In / Providers** → **GitHub**. Copy the **Callback URL**
   shown there (it looks like `https://<project-ref>.supabase.co/auth/v1/callback`).
2. On GitHub: **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**.
   - Homepage URL: `http://localhost:5173`
   - Authorization callback URL: the Callback URL from step 1
3. Register it, then copy the **Client ID** and click **Generate a new client secret**.
4. Back in Supabase, turn GitHub on, paste the Client ID and Client Secret, and **Save**.
   (The client secret lives only in Supabase. Never put it in this repo.)
5. **Authentication** → **URL Configuration**:
   - Site URL: `http://localhost:5173` (or your Vercel URL once deployed, see below)
   - Redirect URLs: add `http://localhost:5173/**`

## 5. Connect the app
1. In Supabase: **Project Settings** → **API Keys**. Copy the **Project URL** and the
   **publishable** key (`sb_publishable_...`).
2. In the repo: `cp .env.example .env.local` and paste both values in.
   Use the publishable key only. The **secret** key must never go in the app
   (`npm run check-secrets` blocks commits that contain it).
3. Restart `npm run dev`. "Sign in with GitHub" appears in the header and the Board fills in.

## 6. Deploy on Vercel (no custom domain needed)
1. In the repo: `vercel` (or import the GitHub repo at vercel.com). `vercel.json` already sends every
   path to the app, so links like `/r/abc123` work.
2. Vercel → Project → **Settings** → **Environment Variables**: add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_PUBLISHABLE_KEY` (same values as `.env.local`) for Production and Preview, then redeploy.
3. Your app lives at `https://<project>.vercel.app`. In Supabase → **Authentication** →
   **URL Configuration**: set Site URL to that, and add `https://<project>.vercel.app/**` and
   `https://*-<your-vercel-team>.vercel.app/**` (preview deploys) to Redirect URLs. Keep the localhost ones.
4. On the GitHub OAuth App, Homepage URL can be the Vercel URL; the callback URL stays the Supabase one.

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
- Guests: Supabase anonymous users. They're real users (role `authenticated`), so every rule below
  applies to them too. `set_username(name)` renames you.
- `rooms`: challenge rooms. A short `code` (the link is `/r/<code>`), a title, brief, wishlist, and the
  creator's `base` setup, which can't be changed after creation (column grants). Only the creator can
  edit or delete a room, or set `winner_id` (which must be an entry in that room).
- `room_members`: who joined which room (for "Rooms you joined").
- Entries are `setups` with a `room_id`, one per person per room (a unique index).
  If a room is deleted, its entries stay on the board.
- `tacks`: thumbtacks, the board's currency. One per person per setup, never your own, rate-limited.
  Only `toggle_tack(target)` writes them and keeps `setups.tacks` in step; you can only read your own.
  `top_of_week(lim)` ranks setups by tacks since Monday (UTC).
- Views: `setup_cards` (now with `tacks`, `room_id`, `tacked_by_me`) and `room_cards` (rooms with their
  creator and entry count).

To change the schema later, add a new file in `migrations/` rather than editing this one.
