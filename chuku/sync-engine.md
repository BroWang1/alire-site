# Sync engine — Chuku keeps its own copy of every box (defined 2026-11-07)

Status: **defined, not built.** Needs your okay on the three questions at the bottom.

## Why

Today the orders page asks Whatnot live on every open: the box list, then what is in each box. That is why it is slow, and why we cannot know *when* a box was dropped off or delivered. Whatnot only tells us the status right now.

The sync engine is a job that runs on its own every few minutes, reads Whatnot, and writes any change into Chuku with a time stamp. The page then opens from Chuku's copy in under a second, and packer pay can see exactly when each box changed status.

## What it does, each run

1. **Walk the box list.** Ask Whatnot for shipments newest first, 50 at a time, back to 45 days. About 45 calls, 15 seconds. Whatnot has no "changed since" filter, so a full walk is the only way to notice a box that went from Dropped off to Delivered two weeks later.
2. **Compare with what we have.** New box: store it. Known box whose status or updated time changed: update it and write one row to the change log: box, old status, new status, time seen.
3. **Fill in contents.** For new boxes, and for boxes whose contents may have changed (items added, cancelled), ask Whatnot what is inside. Three calls per box, spread across runs, into the contents table that already exists.
4. **Note the run.** When it ran, how many boxes seen, how many changed, any Whatnot errors.

Boxes older than 45 days stop being watched. A box that has been Delivered for 7 days also stops being re-read.

## What changes for you

- The orders page opens instantly from Chuku, and shows "synced 3 min ago". The Refresh button now means "sync right now".
- Make labels and Build PDF still talk to Whatnot live. Those cannot be cached.
- Every status change has a time. That is what packer pay counts on: drop-off day, delivered day, cancellation after drop-off.
- The change log also makes the daily "what shipped today" count free.

## Pieces

- Table `wn_shipments`: one row per box, current state (status, buyer, dates, tracking, label yes/no, shipping cost, needed actions), plus first seen and last seen times.
- Table `wn_shipment_events`: the change log (box, from status, to status, seen at).
- Table `wn_sync_runs`: one row per run.
- Existing `wn_shipment_cache` keeps holding contents.
- Edge Function `chuku-sync`: does the run above. One run at a time per shop. Stops and marks the key invalid if Whatnot answers 401. Never creates labels.
- Schedule (your call, 2026-11-07): **every 5 minutes from 9 AM to 4 PM Pacific, every 3 hours outside that**, plus the Refresh button on the page to sync right now. The page shows "last synced" with the time, how many boxes were seen, and how many changed. Supabase's built-in cron runs it; free tier allows this many times over.
- Orders page: reads the tables directly, same sign-in gate. The live functions stay for labels, PDF, and "sync now".
- Existing label-sorter `shipments` rows can be joined on tracking number, so the data page and the orders page talk about the same box.

## Guardrails

- Read only. The sync never asks Whatnot to make a label or change anything.
- Rate limit respected (10 calls a second, with back-off on 429).
- If a run fails half-way, nothing is lost: the next run walks again from the top.
- Change times are accurate to the run interval. With 5 minutes, "dropped off at 2:07" may really be 2:03.

## Questions

1. ~~Interval~~ Answered: 5 min 9–4 Pacific, 3 hours otherwise, manual Refresh, last-synced stamp.
2. **45 days** of watching per box. Enough for delivery and cancellations? (Overseas or stuck boxes can take longer.)
3. **Where do the first rows come from?** The first run writes the last 45 days as "seen now", so status change times start from the day the sync goes live. Nothing before that gets a change time. OK?
