# Talis

ESP32 + MFRC522 RFID reader that posts every Card read to Supabase, plus a Parent page that draws the bus seat map with each Rider in their Seat. Domain terms are in `GLOSSARY.md`.

```
firmware/talis_rfid/   ESP32 sketch (Arduino / Wokwi)
supabase/schema.sql    scans, bus_layout and riders tables, RLS policies
web/                   static Parent page and /admin (no build step)
tests/                 node --test unit tests for the page logic
```

## Setup

1. **Database** – run `supabase/schema.sql` in the Supabase SQL editor. It creates `scans (id, uid, scanned_at)`, which the publishable key can add to and read; `bus_layout`, one row per seat-map cell, seeded once with the real 46-seat bus; and `riders (card_uid, name, seat)`. The publishable key can read both, and only a signed-in admin can add Riders (names are capped at 80 characters). Edit the Bus Layout in the Supabase table editor.
2. **Firmware** – copy `firmware/talis_rfid/secrets.example.h` to `secrets.h` and fill in your Wi-Fi and Supabase values, then open `firmware/talis_rfid/talis_rfid.ino` in Arduino IDE (ESP32 board, `MFRC522` library) or Wokwi. Wiring: RST 32, MOSI 23, MISO 19, SCK 18, SS 4.
3. **Website** – copy `web/config.example.js` to `web/config.js` and fill in your Supabase URL and publishable key, then serve `web/` with any static server:

   ```bash
   python3 -m http.server 8080 --directory web
   ```

   Then open http://localhost:8080 for the Parent page and http://localhost:8080/admin to register an Unknown Card as a Rider. Run the unit tests (seat map layout, Status rules and Unknown Cards) with `npm test` (Node 20+, no dependencies).

## Admin login

`/admin` needs a Supabase Auth email and password. There is no public signup, so create each admin in the Supabase dashboard: **Authentication → Users → Add user → Create new user** (tick *Auto Confirm User*). Only a signed-in user can add Riders.

To pick up schema changes (for example after pulling this), re-run the whole `supabase/schema.sql` in the SQL editor. It is safe to re-run.

## Deploy

The site is static; the only build step writes `web/config.js` from two environment variables.

Set these in the host's dashboard:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_KEY` | your publishable key |

- **Vercel** – import the repo; `vercel.json` already sets the build command and output folder. Leave the root directory as the repo root.
- **Cloudflare Pages** – import the repo, framework preset *None*, build command `sh scripts/build-config.sh`, build output directory `web`.

`secrets.h` and `config.js` are gitignored, so your credentials stay local.
