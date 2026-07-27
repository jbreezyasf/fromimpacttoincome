---
name: verify-before-claiming
description: Discipline for agents doing operational work across systems they cannot fully observe. Use when making claims about infrastructure, config, or deploys; when building anything that writes; or when telling a human an action succeeded. Prevents confident-but-unverified assertions and failures that look like success.
---

# Verify Before Claiming

Two failure classes cause most wasted operator time. They need different fixes.

---

## Class 1 — Asserting about systems you cannot observe

You can read a repo. You usually cannot read the hosting dashboard, the secret
store, the DNS panel, or the third-party console. Reasoning from repo evidence
to a confident claim about those is the single most expensive mistake available.

### Rule: label every claim

- **Verified** — you ran something and saw the result. Name the check.
- **Inferred** — reasoning from evidence you can see. Name the evidence.
- **Assumed** — neither. Say so plainly.

Never present Inferred or Assumed in the same register as Verified. If it turns
out wrong, say which label it carried and correct it in one sentence.

### Rule: never invent an interface

Do not name menu paths, button labels, or screen layouts in a UI you cannot see.
They change, and a wrong path burns the operator's time and your credibility.
Instead: describe the **thing to find** ("the setting that shows which repo and
directory this deploys from"), or ask what they see.

### Rule: prefer evidence the operator can produce

When blocked on an unobservable system, propose checks that return hard data —
a console usage page, an active-sessions list, a log line, a SQL query — over
"go look and tell me if it seems right."

### Rule: one read is not a fact

APIs cache and lag. Before reporting absence ("there is no run", "nothing was
committed"), confirm from a second angle or state the read's timestamp and
limits. Absence of evidence is the easiest thing to get wrong.

---

## Class 2 — Building things whose failure looks like success

A run that does nothing must not resemble a run that did the work.

### Rule: every write emits an observable outcome

State the outcome first and in plain language — *what changed, or that nothing
did* — not a flag the reader must interpret. `mode: preview = true` under a
green check will be missed. **"NOTHING WAS WRITTEN"** will not.

### Rule: safe defaults need loud labels

A destructive-action guard that defaults to "off" is correct. But if the control
is labelled only by its description, the operator may never learn its name or
that it is engaged. Put the parameter name and the consequence in the label.

### Rule: verify the operator's end of the loop

Testing that the code works given input is half the job. Also confirm the
human's action reached the system: did the job start, did the request register,
is the count what you expect? Most "it didn't work" reports are a broken loop,
not broken logic.

### Rule: assume version skew

When two artifacts deploy by different paths (config fetched at runtime vs code
shipped in a build), they *will* be out of sync eventually. Design the older
side to degrade invisibly. Prefer inert markers (comments, no-ops) over
placeholders that render as garbage when unprocessed.

### Rule: read the error, do not pattern-match it

An HTTP status has a specific cause. Fetch the response body before theorising.
"Probably permissions" has a way of being "a required field was omitted."

---

## Where a review panel helps — and where it does not

**Helps: Class 2.** Independent reviewers with assigned lenses — failure modes,
version skew, operator feedback, security, idempotency — reliably catch designs
whose failure is silent. Assign *angles you underweight*, not copies of your
own reasoning.

**Does not help: Class 1.** Reviewers share your blind spots. A panel asked "is
service X deployed from repo Y?" reasons from the same visible evidence and
reaches the same confident wrong answer. More agents amplify a shared blind
spot; they do not remove it. Class 1 is fixed by labelling and by asking, not
by more compute.

---

## Before saying "done"

1. Did I verify the outcome, or only that the code ran?
2. Is every claim labelled Verified / Inferred / Assumed?
3. Can the operator tell success from no-op without reading logs?
4. What did I *not* check, and have I said so?
