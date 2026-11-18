# Giving the agent a browser

This is how you drive a page in the app, and ask it questions.

It uses [agent-browser](https://github.com/vercel-labs/agent-browser), a CLI
built for exactly this — one command per action, an answer on stdout.

## Once, per machine

```bash
npm install -g agent-browser
agent-browser install
```

The factory workflows (`.github/workflows/agent-*.yml`) install it before the
agent starts. Check with `agent-browser --version` before installing.

## Starting the app and logging in

Start the dev server in the background and wait until it answers:

```bash
npm run dev > /tmp/dev.log 2>&1 &
until curl -sf http://localhost:5173/ > /dev/null; do sleep 1; done
```

A page that needs a user returns 401 until you pick one. Post the user's id
to `/api/switch-user` from inside the page, so the session cookie lands in the
browser:

```bash
agent-browser open http://localhost:5173/
agent-browser eval "(async()=>{const f=new FormData();f.set('userId','5');await fetch('/api/switch-user',{method:'POST',body:f});return 'ok'})()"
```

`npm run db:seed` is deterministic, so these fixtures hold on every fresh
database:

| What                         | Where                                                     |
| ---------------------------- | --------------------------------------------------------- |
| Admin                        | user `1` (Alex Rivera)                                    |
| Instructor                   | user `2` (Sarah Chen)                                     |
| Student                      | user `5` (Emma Wilson), enrolled in the two courses below |
| Lesson the student can open  | `/courses/introduction-to-typescript/lessons/1`           |
| Lesson with a quiz           | `/courses/introduction-to-typescript/lessons/3`           |
| Lesson in a second course    | `/courses/building-rest-apis-with-nodejs/lessons/20`      |
| Lesson locked to the student | `/courses/design-systems-with-tailwind/lessons/40`        |

For anything else, ask the database: `sqlite3 data.db "<query>"`.

## Asking your own question

Start the app with `npm run dev` first. The examples below use
`http://localhost:5173`, the dev server's default address — if `npm run dev`
printed a different one, use that.

A screenshot is pixels. To verify a fix you need a yes or a no, so read the
DOM:

```bash
agent-browser open http://localhost:5173/courses
agent-browser find placeholder "Search courses..." fill "typescript"
agent-browser find role button click --name "Search"

# Did the search reach the URL?
agent-browser get url

# How many course cards came back?
agent-browser get count 'a[href^="/courses/"]'

# What does the empty state say, if there is one?
agent-browser get text main

# Did anything break?
agent-browser errors
agent-browser console
```

The commands worth knowing: `open`, `click`, `fill`,
`find <role|text|label|placeholder> …`, `wait`, `get text|html|attr|count|url`,
`is visible|enabled|checked`, `eval`, `snapshot` (the accessibility tree, with
refs), `screenshot`, `console`, `errors`, `close`. `agent-browser --help` has
the rest.

**Ask the page, do not ask the person.** A change you have not looked at is a
change you are reporting on trust.

Screenshots are PR evidence: a before and an after for a change that shows in
the UI.

## Two things that will bite you

**Hydration lags "networkidle".** The button is in the server HTML before
React attaches its `onClick`, so the first click can be a silent no-op. Poll
for the click's effect and click again, rather than waiting a fixed time.

**Vite re-optimizes on the first load.** On a fresh checkout, the first page
load discovers dependencies Vite has not pre-bundled, and pushes a full-page
reload a moment after the response has finished. Absorb it once against a
throwaway load before the real loop; otherwise it lands mid-interaction and
every click after it hits a page that is already navigating away.
