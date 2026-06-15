# Letter Rally

Letter Rally is a real-time two-device word duel with no accounts. Create a six-character room code, share the code or URL, and play a cumulative 3-5 round series. It also includes three bot difficulties, spectators, saved replays, achievements, optional power-ups, sound, vibration, and configurable timers.

## Local setup

Create `.env.local`:

```bash
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

Only use the browser-safe Supabase publishable key. Never put a secret or `service_role` key in a Vite environment variable.

Run:

```bash
npm install
npm run dev -- --host 0.0.0.0
```

Do not open `index.html` directly. Vite applications must be served.

## Supabase backend

Realtime Broadcast and Presence power the current no-login room transport. The repository also contains the server-authoritative game API and dictionary-report endpoint:

```bash
npx supabase login
npx supabase link --project-ref okmrobbuljzeutrrdpxv
npx supabase db push
npx supabase functions deploy game-authority
npx supabase functions deploy dictionary-report
```

The migration creates private, RLS-protected `game_rooms` and `dictionary_reports` tables. The `game-authority` Edge Function keeps player tokens secret, validates actions on the server, advances the authoritative clock, and rejects stale revisions. The service-role key is read only inside Supabase Edge Functions.

The browser room flow continues to use Realtime host authority until the Edge Function is deployed and the client transport is switched on. Do not describe an undeployed build as cheat-proof: host authority is suitable for friendly play, while the included Edge Function is the competitive authority path.

## Features

- 3, 5, or 8 second claim windows and 1, 3, or 5 minute rounds
- Fixed 3, 4, or 5 round cumulative-score series
- Easy, Medium, and Hard bot opponents
- Optional one-use tile swap and unused-penalty shield each round
- Local statistics, achievements, bot records, and the latest ten replays
- Live read-only spectators using a room code
- Dictionary report button with local fallback and Supabase persistence
- Sound cues and mobile vibration, with a persistent sound toggle
- Animated center-to-board tile movement and rare-letter effects
- No consecutive duplicate letters; Q, X, and Z have reduced draw weights

## Scoring

Final words score their tile value plus a length bonus. Every unused tile subtracts its value. A shield removes one unused tile from that penalty. If time expires, the engine chooses each board's best dictionary word and compares the resulting scores. Round scores accumulate across the selected series length.

## Commands

```bash
npm test
npm run lint
npm run build
npm run preview
```
