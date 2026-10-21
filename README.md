# Talis

ESP32 + MFRC522 RFID reader that posts every Card read to Supabase, plus a Parent page that draws the bus seat map with each Rider in their Seat. Domain terms are in `GLOSSARY.md`.

```
firmware/talis_rfid/   ESP32 sketch (Arduino / Wokwi)
supabase/schema.sql    scans, bus_layout and riders tables, RLS policies
web/                   static Parent page and /admin (no build step)
tests/                 node --test unit tests for the page logic
```

## Setup

1. **Database** – run `supabase/schema.sql` in the Supabase SQL editor. It creates `scans (id, uid, scanned_at)`, which the publishable key can add to and read; `bus_layout`, one row per seat-map cell, seeded once with the real 46-seat bus; and `riders (card_uid, name, seat)`, where a name is at most 80 characters. The publishable key can read both, and can add, rename, move and remove Riders (so `/admin` works without a login). Edit the Bus Layout in the Supabase table editor.
2. **Firmware** – copy `firmware/talis_rfid/secrets.example.h` to `secrets.h` and fill in your Wi-Fi and Supabase values, then open `firmware/talis_rfid/talis_rfid.ino` in Arduino IDE (ESP32 board, `MFRC522` library) or Wokwi. Wiring: RST 32, MOSI 23, MISO 19, SCK 18, SS 4.
3. **Website** – copy `web/config.example.js` to `web/config.js` and fill in your Supabase URL and publishable key, then serve `web/` with any static server:

   ```bash
   python3 -m http.server 8080 --directory web
   ```

   Then open http://localhost:8080 for the Parent page and http://localhost:8080/admin to register an Unknown Card as a Rider, or edit and remove Riders. Run the unit tests (seat map layout, Status rules, Unknown Cards and the Riders table) with `npm test` (Node 20+, no dependencies).

## Deploy

The site is static; the only build step writes `web/config.js` from two environment variables.

Set these in the host's dashboard:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_KEY` | your publishable key |

- **Cloudflare Pages** – import the repo, framework preset *None*, build command `sh scripts/build-config.sh`, build output directory `web`.

`secrets.h` and `config.js` are gitignored, so your credentials stay local.
