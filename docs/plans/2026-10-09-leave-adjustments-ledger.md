# Asking for more leave, lending days, and the leave ledger — plan (2026-10-09)

Status: **BUILT 2026-10-09 (uncommitted).** Migrations `20261104100000_leave_lend_extra` and `20261104100001_leave_owed_days` are applied. Tests: unit tests in `year-close.spec.ts`, e2e suite `leave-extra.e2e.js` (38 checks), and a browser check.

What differs from the plan below:
- **Hard cap:** lending is capped at next year's quota.
- **No auto-apply:** the "also apply for the leave" option was dropped.
- **Where it lives:** the Extra leave tab is on Leave approvals (not Leave types), so managers who are given `leave.extra_decide` can reach it.
- **The statement** replaces the old adjustments-only history, and works for every type.
- **Existing data:** past years were marked closed by the migration, so nothing is taken back retroactively.

## Today

- **Adjusting a balance:** HR uses **Adjust** on a person's balance to add or remove days for one year, with a reason (`LeaveBalanceAdjustment`, `adjust()` in `leave-balances.service.ts`).
- **Every added day is a gift.** The system can't record "this is borrowed, take it back next year".
- **Leave in advance (bug-like gap):** a leave type can let *everyone* go below 0 (`negativeBalance`), and at year end the minus is quietly forgiven, because carry-forward is `max(0, left)`.
- **No way to ask HR:** an employee who has used up a leave type just gets "Not enough balance".
- **Year end isn't recorded**, and the history dialog shows only manual adjustments.

## 1. Asking HR for more days

An employee whose balance can't cover a request sees, in the Apply dialog:

> Not enough balance — 0 days of casual leave left. **Ask HR for more days**

The **Ask HR for more days** form is pre-filled from the leave they were applying for (type, dates, days short), plus a reason. It goes to whoever holds the new permission (see section 5); by default that's HR.

The approver answers with one of:

| Option | What it means | Next year |
|---|---|---|
| **Lend days** (allow going below 0) | The person can go up to **N days below 0** on this type. | Whatever they actually used below 0 is **taken from next year's balance** automatically. Unused lent days cost nothing. |
| **Give extra days** | **N days are added** to this year's balance. | Nothing, the days are theirs. |
| **Decline** | With a reason. | — |

After approval, the person applies for the leave as usual. (An option to submit the leave automatically on approval was considered and dropped on 2026-10-09.)

**When the limit is reached:** the Apply dialog blocks with a message like "You've used all 3 lent days of casual leave — ask HR again". A new request then goes back to HR, as you described.

### Why "lend" and "advance" are one thing

In the first draft I had separate "advance" days and "negative balance" options. They behave the same way: both let someone take N more days, and next year they lose only the days they actually used. So there is just one option, **Lend days**, and the balance card shows it plainly: "−2 · 1 more day can be borrowed · taken from 2027".

## 2. HR's direct adjustments (without a request)

**Adjust** on someone's balance keeps working, but HR now picks a kind:

| Kind | Days | Next year |
|---|---|---|
| **Give extra** | + | Nothing |
| **Lend** | allow −N | Days used below 0 are taken back |
| **Correction** | ± | Nothing (fixing a mistake) |
| **Deduction** | − | Nothing (encashment, or leave taken outside the system) |

Adjustments are always for one person at a time (decision 5).

### Where HR does it

All three places below open the same **Lend / give extra days** dialog:

1. **Requests:** the **Extra leave** tab on the Leave types page lists requests waiting for a decision. Each one has a Review button, which opens the dialog pre-filled from the request.
2. **The person's profile:** the Leave tab already has an **Adjust** button on each balance card (today's "Adjust" icon). It opens the dialog with the person and type already chosen.
3. **A quick shortcut:** the Extra leave tab has a **Lend / give days** button. HR searches for a person by name and picks the leave type, without having to open the profile.

## 3. Taking lent days back

- **When:** the first time the person's new-year balance is set up, which in practice is from 1 January. It's recorded as its own entry: "−2 · taken back: lent in 2026".
- **Cap on lending:** HR can't lend more than next year's quota for that type. The form warns about this, so a debt can never be bigger than what can be taken back.
- **Not enough days next year** (for example, a prorated or reduced quota): what's there is taken, and the rest stays **outstanding** into the following year. The balance never goes below 0 because of a take-back.
- **Monthly build-up types** (Earned): lent days are still taken back next year, not from later months of this year. This keeps the rule simple for people to follow.
- **Waive:** HR can cancel an outstanding amount, with a reason that is kept in the history.
- **Someone leaves while still owing days:** they appear on HR's exit list as "days to recover in final settlement". Once payroll exists, this becomes a pay deduction.
- **Type-wide setting** (`negativeBalance` on a leave type) keeps working for everyone. At year end its minus is now also taken back instead of forgiven. Each type gets a setting: "Below 0 at year end: take from next year / forgive".

## 4. Leave ledger (the records)

One statement per person, leave type and year, like a bank statement:

```
2026 · Casual Leave                                     Days  Balance
 1 Jan  Opening: 12 for the year                         +12     12
 2 Jul  Leave 1–12 Jul                                   −10      2
 9 Oct  Asked HR: "Father's surgery" → Lent 3 (Anita)            2   (can go to −3)
12 Oct  Leave 12–15 Oct                                   −4     −2
31 Dec  Year end: −2 owed · 0 carried · 0 lapsed                 −2
2027 · Casual Leave
 1 Jan  Opening: 12                                      +12     10
 1 Jan  Taken back: lent in 2026                           —     10
```

- **Built from data we already keep:** allocation, monthly credits, leave requests and cancellations, grants, and adjustments.
- **New stored entries:** year-end rows (carried over, expired, lapsed, taken back, waived), so the history is permanent.
- **Where it shows:**
  - a "History" for each type in the profile's Leave tab, replacing today's adjustments-only dialog;
  - My leave, where people see their own statement;
  - a CSV export for HR.

## 5. Permissions (decision 3)

There are new permissions in the access catalog, set per role like the others:

| Permission | Who has it by default | Reach |
|---|---|---|
| `leave.extra_request` (ask for more days) | Everyone | Own |
| `leave.extra_decide` (lend / give / decline) | HR | Company (a role can be given team reach instead) |

- Requests go to whoever holds `leave.extra_decide` over that person.
- **Adjust** keeps using `leave.adjust_balance`.

## Data model (one migration)

```prisma
enum LeaveAdjustmentKind { EXTRA LEND CORRECTION DEDUCTION TAKEN_BACK WAIVED }
enum ExtraLeaveStatus   { PENDING LENT GIVEN DECLINED CANCELLED }

model LeaveBalanceAdjustment {
  // …existing: balanceId, days, reason, adjustedById, createdAt
  kind         LeaveAdjustmentKind @default(CORRECTION)
  /// LEND: how far below 0 this lets the person go
  lendLimit    Float?
  /// What is still owed from this LEND (days used below 0 not yet taken back)
  outstanding  Float   @default(0)
  /// TAKEN_BACK / WAIVED point to the LEND they settle
  settlesId    String? @db.Uuid
  requestId    String? @db.Uuid
}

/// "Ask HR for more days"
model ExtraLeaveRequest {
  id, companyId, employeeId, leaveTypeId, year
  days        Float          // how many more they need
  startDate   DateTime? @db.Date   // the leave they were booking (optional)
  endDate     DateTime? @db.Date
  halfDay     HalfDaySession?
  reason      String
  status      ExtraLeaveStatus @default(PENDING)
  decidedById, decidedAt, decisionNote
  adjustmentId String? @db.Uuid         // the LEND / EXTRA it created
}

model LeaveBalance {
  // …existing
  /// Sum of active lend limits on this row: how far below 0 the person may go
  lendLimit   Float     @default(0) @map("lend_limit")
  /// Written when the next year starts (the ledger shows them later)
  carriedOut  Float?    @map("carried_out")
  lapsed      Float?
  owedOut     Float?    @map("owed_out")
  closedAt    DateTime? @map("closed_at")
}

model LeaveType {
  // …existing
  /// Below 0 at year end: take from next year (default) or forgive
  recoverNegative Boolean @default(true) @map("recover_negative")
}
```

Existing adjustments become **EXTRA** if positive and **DEDUCTION** if negative (5 rows in the dev database today).

## Where the code changes

- **Applying for leave (`evaluate()`):** the limit becomes `type.negativeBalance + balance.lendLimit`. When it's exceeded, the error offers "Ask HR for more days", and when lent days run out it says so.
- **Starting the new year (`ensure()`):** when the new-year row is created, the same transaction also:
  - closes the old year by writing carried, lapsed, owed and closedAt;
  - takes back what's owed with TAKEN_BACK rows, splitting it over later years if next year's balance is too small.
- **New `ExtraLeaveService`:** ask, list (mine / to decide), lend / give / decline, and cancel.
  - Notifications go to the people who decide and to the employee.
- **Ledger:** `GET leave/ledger?employeeId&leaveTypeId&year`.
- **HR lists:**
  - `GET leave/owed` shows outstanding days, with **Waive**;
  - the exit checklist shows people owing days.
- **Pure functions (unit-tested):** what's owed at year end, splitting a take-back across years, and the ledger's running balance.
- **Web:**
  - Apply dialog: the "Ask HR for more days" link and form, and the blocked-at-limit message.
  - A new **Extra leave** tab next to Grants, with the requests to decide and the owed list.
  - The Adjust dialog with kinds and a preview of now and next year.
  - The History statement.
  - The "−2 · 1 more can be borrowed · taken from 2027" line on the balance card.
- **Tests (e2e):**
  - ask → lend → use part of it → limit blocks → new year takes back only what was used;
  - give extra → nothing taken back;
  - too little next year → amount stays outstanding;
  - waive;
  - a leaver appears on the exit list;
  - permission by role (a team-reach role decides only for its team).

## Decisions (2026-10-09)

- **Asking HR:** employees can ask for more days when a balance runs out. HR lends (go below 0, taken from next year) or gives extra (kept).
- **Limit reached:** further leave is blocked, and the person asks again.
- **Minus balances:** taken from next year.
- **Who decides:** set through roles and permissions (`leave.extra_decide`). HR by default.
- **Leavers owing days:** a list for HR's exit checklist; pay deduction once payroll exists.
- **No bulk:** HR adjusts one person at a time for now.

## Still to confirm

1. **One "Lend days" option** instead of separate "advance" and "negative balance" options, since they work the same way?
2. **Cap lending at next year's quota** for that type?
