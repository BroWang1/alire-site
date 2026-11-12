# Tracking check (USPS)

Status: function and tables built 2026-11-12, **blocked on USPS access approval** (see bottom).

## Why
Whatnot's "In transit" means the label was scanned at the shop (Monterey Park). It says nothing about USPS.
Dry run 2026-11-12 on 10 real In-transit boxes: 2 of 7 checkable ones had sat at "Shipping Label Created, USPS
Awaiting Item" for 19 and 29 days; Whatnot still said In transit. 3 used letter postage, which USPS cannot track at all.

## Rule (owner, 2026-11-12)
- The clock starts at the shop scan (Whatnot flips to In transit; Chuku records the moment).
- Within 2 days (Sundays not counted) USPS must show a real scan.
- If not: red flag "Scanned Nov 8, USPS still has not received it", its own tile on the Orders page, later the morning email.
- When USPS has it: "In transit, Memphis TN, Nov 9", flag clears. USPS Delivered marks the box delivered (Pay page sees it sooner).
- Letter postage (`usps_first_class_mail_letter`, tracking `0031...`): "Letter, cannot be checked", outside the rule.
- First sweep covers everything In transit (542 on 2026-11-12: 106 pre-Chuku, 143 scanned > 2 d ago, 293 < 2 d).

## Pieces
- `supabase/functions/chuku-track/index.ts`: `{test:[numbers]}` returns USPS's raw answer; `{sweep:true}` checks every
  undelivered trackable box not checked in 20 h, 35 per USPS call, 24 calls per run max, writes `wn_tracking` + `wn_track_runs`.
  Auth like chuku-sync (x-sync-key from chuku_settings, or signed-in allowed user). Secrets USPS_CLIENT_ID / USPS_CLIENT_SECRET
  (owner pasted them into the dashboard 2026-11-12).
- `chuku/track.sql`: tables `wn_tracking`, `wn_track_runs`, RLS read policies. Run in the dashboard 2026-11-12.
- USPS: OAuth client credentials `POST https://apis.usps.com/oauth2/v3/token` (JSON, scope tracking);
  Tracking 3.2 `POST https://apis.usps.com/tracking/v3r2/tracking` with `[{trackingNumber}]` (1-35), 200 = array of
  TrackingDetail, 207 = mixed. Specs saved from developers.usps.com (tracking-v3r2_7.yaml, oauth2_update_1.yaml).

## Not built yet
- ~~Daily cron~~ scheduled 2026-11-12: `chuku-track` daily 14:00 UTC, body `{"sweep":true}`; logs 403 until USPS approves, then works.
- Orders page: "Where is it" line per box, tile "USPS never got it", chip, 2-day rule with Sundays skipped.
- Email line.

## Blocker (2026-11-12)
First real call returned HTTP 403: "The requested MID is not authorized for access to /tracking. USPS implemented Tracking
API Access Controls 4/1/2026. If you still require access submit an IP Agreement inquiry via Email Us
https://emailus.usps.com/s/usps-APIs or call the API Access Control Helpdesk 1-(877)-672-0007 dial option #6 then option #2."
The token and the function work; only USPS's permission for this account's Mailer ID is missing. Owner submitted the IP Agreement inquiry 2026-11-12 (API Onboarding form).
