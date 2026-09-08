# Daily update — VS Code, then push

`users.json` is the whole system. The page reads it and reveals `names[0]`.

| Field | Role |
|---|---|
| `names[0]` | the name the reel lands on at 8pm |
| `names[1..8]` | the eight slots shown around it |
| `names[9..]` | the rest of the pool — only blurs past during the spin |
| `winner_history[0]` | the same name plus a date, for the overlay |

## The edit

In VS Code, open `users.json`. It's 396 KB, so use **Ctrl+G** (**Cmd+G** on Mac)
to jump by line rather than scrolling.

**1. Move tonight's winner to the top of `names`.** Line 2 onward:

```jsonc
{
  "names": [
    "tonights_winner",     ← the page reveals this one
    "rosalie1998",         ← these eight fill the surrounding slots
    "acinaj09",
```

Delete the previous winner's line while you're there — that's been the
convention, though it has drifted (see warnings below).

**2. Add the history entry.** Find `"winner_history"` with **Ctrl+F**, and add
a new object as the first item:

```jsonc
  "winner_history": [
    { "name": "tonights_winner", "date": "September 8,2026" },
    { "name": "Vikingzbet", "date": "September 5,2024" },
```

The name must match `names[0]` exactly. Date format is
`Month D,YYYY` — no space after the comma.

## Check it before you push

**Where:** the VS Code terminal — **Terminal → New Terminal**, or **Ctrl+`** —
with the folder containing `users.json` as the working directory. Needs Node 18+.

```bash
node tools/check.mjs
```

Clean file:

```
Checked users.json
  15171 names, 1025 history entries
  tonight's reveal: tonights_winner

All good. Safe to push.
```

Broken file — it names the line and stops you:

```
INVALID JSON — the page will not load this file.

  Expected double-quoted property name in JSON at position 396312
  around line 19299

  In VS Code: Ctrl+G (Cmd+G on Mac), type 19299, Enter.
  Usually a trailing comma or a missing quote.
```

Exit code is 1 on anything fatal, 0 when it's safe, so it also works as a
pre-push hook if you want it automatic.

## Then push as usual

```bash
git pull                    # only matters if anyone else pushes to this repo
git add users.json
git commit -m "Draw: tonights_winner"
git push
```

Pushing is deploying — GitHub Pages rebuilds the site on every push to the
default branch. Give it a minute or two before the file is live, and check
the Actions tab if it seems slow.

**Timing.** Publish by 19:45 to be comfortable. The page now re-reads
`users.json` as the reel lands, so a tab someone left open since the morning
picks up your change too — that used to be broken, and tabs opened early
revealed the previous night's name. It is still worth leaving margin for the
Pages deploy rather than pushing at 19:59.

## What the check found in the current file

Worth clearing at some point — all of it came from hand-editing:

- **`winner_history[486]`** has the key `"neme"` instead of `"name"`, and
  **`winner_history[666]`** has `"data"` instead of `"date"`. Both render blank
  in the overlay today. These are the two errors the check reports.
- **Seven different date formats** across the history: `September 5,2024`,
  `September 5, 2024`, `Sept. 5, 2024`, `AUGUST 31, 2026`, and three entries
  that are just a month name with no day or year.
- **10 duplicated names** in the pool, clustered around index 10207-10235 —
  looks like a block got pasted twice.
- **349 past winners are still in `names`**, so they can come up again.

None of these stop the page loading. The two typo'd keys are the only ones
users actually see.

## Testing the reveal without waiting until 8pm

```bash
node tools/serve.mjs --at 19:59:50
```

Open <http://localhost:5173>. Time runs forward from 19:59:50, so the reel
spins ten seconds later. Other useful points:

```bash
node tools/serve.mjs --at 21:30      # after the draw — flat reveal, no spin
node tools/serve.mjs --at 12:00      # mid-day — countdown, empty slots
node tools/serve.mjs                 # real Manila time
```

Run it from the project folder — it exits with `No index.html in <path>` if
the terminal is somewhere else.

## `draw.mjs` is not part of this

It picks a winner at **random**. That is not how this draw works, so it is
unused. The workflow that called it has had its schedule removed and can only
be started by hand. If nobody ever wants a random draw, delete both.

## If the page ever goes blank at 8pm

It's almost always malformed JSON. `script.js` has no fallback — a parse failure
leaves it on "Waiting for Today's Lucky Winner" indefinitely, with the real error
only in the browser console. Run `node tools/check.mjs`, fix the reported line,
push, and wait for the Pages deploy.
