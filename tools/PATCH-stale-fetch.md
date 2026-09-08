> **Applied — kept for the reasoning only.**
>
> This is now `refresh()` in `script.js`, called from `getRandomName()` just
> before the reel lands. Do not apply it again. One detail below is out of
> date: `DATA_URL` is no longer `raw.githubusercontent.com`, it is the site's
> own `users.json`, so the rate-limit warning at the end no longer applies.

# Patch: re-read the data before the spin

## The problem

`script.js` fetches `users.json` **once, on page load**, and never again:

```js
fetch(DATA_URL).then(...).then(json => { data = json; ... });
```

Someone who opens the page at 18:00 is holding the file as it looked at 18:00.
If you publish the winner at 19:30, that tab never sees it — at 20:00 it spins
for five seconds and lands on *yesterday's* winner, while a tab opened at 19:45
lands on today's. Two people watching the same draw see two different names.

This is why the draw currently has to be published well before 20:00: the page
can only reveal what it already downloaded. Which in turn is why the result sits
readable at a public URL for however long that window is.

## The fix

Re-read the file immediately before the reel lands. Six lines.

In `script.js`, replace the body of `getRandomName()`'s timeout:

```js
  setTimeout(() => {
    clearInterval(spinTimer);
    winnerSlot.innerText = `${data.names[0]}`;
    isSpinning = false;
    ...
```

with:

```js
  setTimeout(async () => {
    // Re-read just before landing: a tab opened hours ago is holding a stale
    // copy, and would otherwise reveal the previous day's winner.
    try {
      const fresh = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (fresh.ok) data = await fresh.json();
    } catch (error) {
      console.error('Could not refresh before the reveal:', error);
    }

    clearInterval(spinTimer);
    winnerSlot.innerText = `${data.names[0]}`;
    isSpinning = false;
    ...
```

The `?t=` and `cache: 'no-store'` matter — `raw.githubusercontent.com` serves
with a five-minute cache header, so without them you get the stale copy back.

## What this buys you

Every tab reveals the same name regardless of when it was opened, and the
publishing window shrinks to whatever you choose rather than being forced wide
by the single fetch. It costs one request per viewer at 20:00:05.

That request lands on `raw.githubusercontent.com` all at once. It is not a CDN
and is rate-limited per IP; a few thousand simultaneous viewers will see some
429s. If you take this patch, move `users.json` behind a real CDN or an API
endpoint at the same time.

## Note

This is a fix, not part of the faithful recreation. The clone in this folder
behaves exactly like the original, stale tabs included. Apply this only if you
are moving the build toward production.
