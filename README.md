# GBET Lucky Draw

A rebuild of the original. `index.html`, `styles.css`, the images, the sound
and `users.json` are the originals unchanged. Only `script.js` was rewritten —
the shipped version was minified and had its data URL split across a dozen
decoy variables.

## How it works

A CSR chooses the winner. You put that name at the top of `names` in
`users.json`, add the history entry, and push. GitHub Pages redeploys, and at
20:00 Manila the page spins the reel and reveals `names[0]`.

See [tools/README.md](tools/README.md) for the daily edit and
[DEPLOY.md](DEPLOY.md) for the one-time hosting setup.

## Verified against the original

Both builds were run side by side in a headless browser with the network
stubbed and the clock frozen, at three points in the day:

| Scenario | Result |
|---|---|
| 19:59:52 — 8s before the draw | identical: countdown → 5s spin → lands on `names[0]`, glow, confetti, slots filled with `names[1..8]` |
| 22:00 — after the draw | identical: flat reveal, no spin |
| 12:00 — mid-day | identical countdown, slots cleared |

Screenshots at 1440×1024 and 430×932 diff to zero across the banner, board,
logo and text. The only differing pixels are outlines on the floating coins,
which is the `moving.webp` layer caught at a different point in its transition.

## Three things fixed for production

The recreation otherwise reproduces the original's quirks rather than
correcting them. These three would have broken the site, so they were fixed.

**The reveal is read again as the reel lands.** The original fetched
`users.json` once, on page load, and never again — so a tab opened at 18:00
landed on the *previous* night's winner while a tab opened at 19:45 landed on
tonight's. Two people watching the same draw saw two different names.
`refresh()` in `script.js`.

**The clock no longer depends on `worldtimeapi.org`.** That API has had
extended outages, and the original had no fallback: if the fetch failed,
`clockReady` stayed null and the page sat on "Waiting for Today's Lucky
Winner" forever. Time now comes from the `Date` header on the `users.json`
response — the request the page was making anyway — falling back to the
device clock. `startClock()` in `script.js`.

**`users.json` is served from the site itself.** `DATA_URL` pointed at
`raw.githubusercontent.com`, which is not a CDN and is rate-limited per IP.
Under real traffic some visitors would have got a 429 and an empty board.

One smaller change: the countdown used to clear six of the eight slots
(`i < 6` over an eight-item list), so slots 7 and 8 kept the previous night's
names underneath the countdown. It now clears all eight.

## Known quirks, carried over as-is

**The clock drifts.** Time is read once, then a counter is incremented by hand
inside `setInterval`. Timers throttle in background tabs, so a page left open
all day loses minutes and the draw fires late in that tab. `updateTime()`.

**The reveal doesn't survive a spin outside the window.** Force
`getRandomName()` mid-day and the next 1-second tick overwrites the winner
with the countdown. Only intentional between 20:00 and midnight.

## Running it locally

```bash
node tools/serve.mjs
```

Open <http://localhost:5173>. To see the reveal without waiting until 8pm:

```bash
node tools/serve.mjs --at 19:59:50
```

Time runs forward from there, so the reel spins ten seconds later.
`python3 -m http.server 5173` also works for plain browsing — you just can't
fake the clock with it.

## Data problems in `users.json`

All from years of hand-editing. `node tools/check.mjs` reports them. None
block the launch:

- **`winner_history[486]`** has the key `"neme"` instead of `"name"`, and
  **`winner_history[666]`** has `"data"` instead of `"date"`. Both render blank
  in the overlay.
- **Seven different date formats**: `September 5,2024`, `September 5, 2024`,
  `Sept. 5, 2024`, `AUGUST 31, 2026`, and three entries that are just a month
  name with no day or year.
- **10 duplicated names**, clustered around index 10207-10235 — a block looks
  pasted twice.
- **349 past winners are still in `names`**, so they can come up again.

## About `tools/draw.mjs`

It picks a winner at **random**, which is not how this draw works. It is
unused, and the workflow that called it has had its schedule removed so it
cannot fire on its own. Delete both if you are sure you'll never want one.
