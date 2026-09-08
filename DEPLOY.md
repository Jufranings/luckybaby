# Going live on GitHub Pages

The site is entirely static — HTML, CSS, images, a sound and `users.json`.
There is no server, no build step and nothing to configure. GitHub Pages hosts
it free and redeploys on every push, which is what makes your daily update
work: edit `users.json`, push, and the live site has it a minute later.

## One-time setup

### 1. Make it a git repository

In the VS Code terminal (**Ctrl+`**), from the project folder:

```bash
git init
git add .
git commit -m "GBET Lucky Draw"
```

Git is already set up with your name and email, so this will just work.

### 2. Create the repository on GitHub

Go to <https://github.com/new>.

- **Name** — anything, e.g. `lucky-draw`. If you name it exactly
  `YOUR-USERNAME.github.io`, the site lives at `https://YOUR-USERNAME.github.io`
  instead of `https://YOUR-USERNAME.github.io/lucky-draw/`. Both work.
- **Public** — required for Pages on a free account.
- **Do not** tick "Add a README" or any other starter file. You already have
  files, and those options create a conflict you'd have to untangle.

Then push, using the URL GitHub shows you:

```bash
git remote add origin https://github.com/YOUR-USERNAME/lucky-draw.git
git branch -M main
git push -u origin main
```

The first push asks you to sign in. VS Code usually opens a browser window for
this; if it asks for a password in the terminal instead, that is a *personal
access token*, not your GitHub password — create one at
<https://github.com/settings/tokens> with the `repo` scope.

### 3. Turn on Pages

In the repository: **Settings → Pages**.

- **Source** — Deploy from a branch
- **Branch** — `main`, folder `/ (root)`
- **Save**

Wait a minute or two, then reload that page. It will show the live URL at the
top. Open it — you should see the countdown.

## Your daily routine after that

Exactly what you do now, plus the check:

```bash
git pull                    # only if anyone else pushes to this repo
# edit users.json in VS Code — winner to names[0], history entry on top
node tools/check.mjs
git add users.json
git commit -m "Draw: tonights_winner"
git push
```

Full detail in [tools/README.md](tools/README.md).

**Publish by about 19:45.** Not because the page can't cope — it re-reads
`users.json` as the reel lands now, so even a tab left open all day gets your
change — but because the Pages deploy itself takes a minute or two and you
don't want to be watching it at 19:59.

## Checking it worked

After a push, the repo's **Actions** tab shows the Pages deploy. Once it's
green:

```
https://YOUR-USERNAME.github.io/lucky-draw/users.json
```

Open that in a browser and confirm the first name under `"names"` is tonight's
winner. If it still shows the old one, the deploy hasn't finished — wait, then
hard-reload with **Ctrl+Shift+R**.

## What to know about this setup

**The winner is readable before 8pm.** Anyone who opens the URL above, or looks
at the repository, sees tonight's name from the moment you push. That is how
the original worked and you chose to keep it. If that ever becomes a problem,
the fix is not a bigger cache header or a private repo — the file has to stop
containing the answer, which means a small server-side endpoint. Ask and I'll
build it.

**A push is a deploy.** Broken JSON goes live immediately, and the page has no
fallback — it sits on "Waiting for Today's Lucky Winner" forever with the error
only in the browser console. `node tools/check.mjs` before every push is the
whole defence, and it exits non-zero on failure so you can wire it as a
pre-push hook.

**The clock comes from GitHub's servers now**, not `worldtimeapi.org`. The page
reads the `Date` header on the `users.json` response — the request it was
making anyway — so there is no third-party API left to go down and strand the
page. If that header is somehow missing it falls back to the viewer's own
device clock.

**`users.json` still has known data problems** — two typo'd history keys that
render blank, seven date formats, 10 duplicated names, and 349 past winners
still in the pool. `node tools/check.mjs` lists them. None block the launch.
