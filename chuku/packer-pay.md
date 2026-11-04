# Packer pay — rules as discussed on 2026-11-03

Status: **defined, not built.** Nothing below exists yet. Needs the sync engine first (see bottom).

## What it does

- A new page beside Order management. Working name: **Packer pay**.
- Every box that gets dropped off earns a credit based on how many **different items** (SKUs) are in it.
- Rates live in a small settings table you can change any time. Each box keeps the rate that was in force on the day it was dropped off, so a rate change never rewrites old pay.
- Work is assigned **by order day**. The page tells the packer "do Nov 1 next" = the oldest day that still has shipping boxes not yet dropped off. He does not pick the day or report which one he is on.
- A day's credit is **counted when its boxes show dropped off in Whatnot**. Nobody types anything; Whatnot's status is the proof. The page also logs how many boxes went out each calendar day.
- Credit becomes **payable when the box shows delivered**, as long as it was not cancelled in between. A cancellation removes that box's credit.
- The packer sees: what to do next, what he has earned that is still pending, what is now payable.
- You see the same, plus a running total and a **Mark paid** button.
- Both of you get a notice when a day becomes payable.

## Rates as stated (to be confirmed, see question 1)

| Different items in box | Credit |
|---|---|
| 1–3 | 20¢ |
| 3–5 | 25¢ |
| 5+ | 40¢ |

## Open questions (answer before building)

1. **Bands overlap.** Is it 1–2 / 3–4 / 5+, or 1–3 / 4–5 / 6+?
2. **SKU = different items, not units.** A box with four of the same squishy counts as one. Correct?
3. **Pickups** never get dropped off. No credit, or does packing a pickup pay something?
4. **A day is done** when every shipping box in it is dropped off or further along. Cancelled boxes do not block it. Agree?
5. **Payout timing.** Pay each box as it delivers, or hold the whole day until its last box delivers? For boxes that never reach delivered (stuck tracking), suggestion: pay after 14 days with no cancellation.
6. **Who sees it.** Does the packer get his own sign-in on the allowed list, or do you show him your screen?
7. **Pay period.** Weekly list of what became payable, or on demand?

## What has to exist first

Whatnot only reports a box's status *right now*, not when it was dropped off. To know the drop-off day, and to catch a cancellation after drop-off, something has to check Whatnot on a schedule and record every change. That is the **sync engine** already queued as the next step.

Build order:
1. Sync engine — records every status change per box with a time.
2. Pay rules on top of it (rates table, credit ledger, cancellation reversal).
3. Packer page + notices (Resend email).
