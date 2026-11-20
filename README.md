# DropSpace

A shared white space. Drag any file or video onto it; everyone in the same space sees it instantly.

## Setup
1. Create a free project at supabase.com.
2. In the SQL Editor, run `supabase/setup.sql`.
3. Copy `.env.example` to `.env` and fill in your project URL and anon key
   (Project Settings -> API).
4. `npm install`
5. `npm run dev`   (opens the desktop app)
6. `npm run dist`  (builds an installer into `release/`)

Run the app on two machines (or open two copies), click "New space" on one,
and type the 6-letter code on the other.
