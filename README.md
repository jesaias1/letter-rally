# Letter Rally

Letter Rally is a real-time two-device word duel. One player creates a room, sends the generated URL to a friend, and the five-minute match begins automatically when both devices connect. No accounts or login are required.

## Supabase configuration

This project is configured for:

```text
https://okmrobbuljzeutrrdpxv.supabase.co
```

The project reference and REST URL are not sufficient to connect a browser client. Copy the **Publishable key** from **Supabase Dashboard → Settings → API Keys**, then create `.env.local`:

```bash
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

Legacy projects may use the browser-safe `anon` key instead. Never place a secret key or `service_role` key in this frontend.

In **Supabase Dashboard → Realtime Settings**, keep **Allow public access** enabled. Letter Rally uses public Broadcast and Presence channels, so no database tables or SQL migrations are required for this MVP.

Restart Vite after changing `.env.local`.

## Run locally

On Windows, double-click `Start Letter Rally.cmd`, or run:

```bash
npm install
npm run dev -- --host 0.0.0.0
```

The host creates a room and copies the invite URL. A device on the same network can open the Network URL printed by Vite, but `localhost` URLs only work on the computer running Vite.

For friends on different networks, deploy the `dist` build to a public HTTPS host such as Vercel, Netlify, or Cloudflare Pages, and configure the same environment variable there.

Do not open `index.html` directly. Vite applications must be served.

## Commands

```bash
npm test
npm run lint
npm run build
npm run preview
```

## Multiplayer architecture

- Supabase Realtime Broadcast carries actions and authoritative state snapshots.
- Supabase Presence shows whether both devices are connected.
- The room creator is the authority for timers, random letters, claim timestamps, validation, tie-breaking, scoring, and rematches.
- The invited player controls only Player 2; the host controls only Player 1.
- Room codes use a random 10-character URL-safe alphabet.
- Rooms are ephemeral. If the host closes the tab, the room ends.
- No gameplay data is written to a database.

This architecture is appropriate for friendly no-login matches. Competitive ranked play should move authority to an Edge Function or dedicated game server.

## Rules

1. A random letter appears for five seconds.
2. Each player may claim it using a dictionary word of at least four letters containing that letter.
3. Fastest valid claim wins; near-ties use word length and Scrabble-style value.
4. Only the displayed letter is awarded.
5. Each successful claim locks the displayed letter's position in that player's claim word.
6. A player cannot reuse the same position for that letter or repeat an exact claim word.
7. The first player to submit a valid five-letter word built from their collected tiles wins.
8. After five minutes, the engine finds each board's best available word and applies unused-letter penalties.

## Verification

The test suite covers validation, duplicate letters, position locks, claim resolution, scoring, room-code generation, and the five-minute match duration.
