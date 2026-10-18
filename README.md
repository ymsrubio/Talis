# Talis

ESP32 + MFRC522 RFID reader that posts every card scan to Supabase, plus a website that shows the scans live.

```
firmware/talis_rfid/   ESP32 sketch (Arduino / Wokwi)
supabase/schema.sql    scans table, RLS policies, realtime
web/                   static dashboard (no build step)
```

## Setup

1. **Database** – run `supabase/schema.sql` in the Supabase SQL editor. It creates `scans (id, uid, scanned_at)` and lets the publishable key add and read scans.
2. **Firmware** – copy `firmware/talis_rfid/secrets.example.h` to `secrets.h` and fill in your Wi-Fi and Supabase values, then open `firmware/talis_rfid/talis_rfid.ino` in Arduino IDE (ESP32 board, `MFRC522` library) or Wokwi. Wiring: RST 32, MOSI 23, MISO 19, SCK 18, SS 4.
3. **Website** – copy `web/config.example.js` to `web/config.js` and fill in your Supabase URL and publishable key, then serve `web/` with any static server:

   ```bash
   python3 -m http.server 8080 --directory web
   ```

   Then open http://localhost:8080.

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
