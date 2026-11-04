# Print batch — pull untracked boxes, pick, combine, sort (defined 2026-11-04)

Status: **defined, not built.** Lives inside the Order management page, not a new page.

## What Whatnot's API allows (checked against the saved reference)

- Every shipment has a status. "Not yet tracked by the carrier" = `created` (no label yet) and `label_generated` (label made, not dropped off). `dropped_off` and later are already gone.
- A labeled shipment has `documents.bundled_url`: one PDF with the label + packing slip (pickup slip for pickups). The link lasts 1 hour, so each build re-fetches fresh links.
- For a shipment with no label, `POST /shipments/{id}/generate_label` queues label creation. Whatnot answers "queued", not "done": we then re-read the shipment until it shows `label_generated` (or get the webhook later). It can answer 403 (seller not verified / scope) or 409 (shipment settings block it). This buys postage, so it is a real action with a cost.
- Every order carries `show_id`, and `GET /shows?status=ended` lists shows with title and start time. So "which stream" is knowable per box through its orders. A combined box can hold orders from more than one show.
- Whatnot's PDF links are on S3 without browser permission, so the PDFs must be fetched and merged on our side (the Edge Function), not in the browser.

## What it does

1. **Pull.** A new "To print" view on the orders page: all boxes in `created` or `label_generated`, plus pickups (toggle). Grouped by day as now; a show column/chip added so boxes can also be grouped by stream.
2. **Pick.** Three ways to select, all combinable:
   - tick individual boxes,
   - tick a whole day (header checkbox),
   - tick a whole show (show chip).
   A counter shows "N boxes picked, M still need labels".
3. **Labels for the ones without.** Button "Make labels for M boxes". Shows the list first, you confirm, then it asks Whatnot once per box, waits for each to flip to `label_generated` (about 5–20 s each, in parallel), and reports any that Whatnot refused. Guardrails: never ask twice for the same box; per-run cap (default 150); a box that failed is shown, not retried silently.
4. **Combine and sort.** Button "Build PDF (N boxes)". The Edge Function fetches each box's bundled PDF, puts them in order, and hands back one PDF:
   - one-item boxes first, in piles by item, biggest pile first (A–Z option),
   - then multi-item boxes, fewest different items first,
   - pickups last (if included),
   - optional first page: item counts for the whole batch (pick list).
   Same rules as the existing Label Sorter, but driven by data we already have instead of reading the PDF text, so no mis-sorts.
5. **Record it.** The batch is saved into Chuku's existing `batches` / `shipments` tables (same ingest as the data page), so the data page and the future packer pay see the same batch. Keep a copy of the merged PDF for 7 days so a reprint never re-asks Whatnot.

## What has to change

- Edge Function `chuku-orders`: add `show_id` to cached order contents; new actions `generate_labels` (with cap + once-only), `build_pdf` (pdf-lib merge, sorted), `shows` (titles for the chips).
- Orders page: "To print" filter, checkboxes, show chips, the two buttons, progress in the existing loader strip.
- Storage bucket for merged PDFs (7-day cleanup).
- Optional: webhook endpoint for `shipments.label_generated` so we stop polling. Not needed for v1.

## Open questions

1. Pickups: in the batch by default, or off by default?
2. Sort rule inside the PDF: exactly the Label Sorter order above, or something new?
3. Pick-list page at the front: yes or no?
4. Making labels: should it ask you every time (approval), or only when the count is above some number?
5. One-time check needed: does Maddie's token get a 403 on `generate_label`? Needs one real test on one box you choose.
