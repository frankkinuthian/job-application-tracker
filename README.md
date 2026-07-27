# Job Tracker

A kanban board for tracking job applications. Built with Next.js 16 (App Router), MongoDB via Mongoose, and Better Auth.

Applications live on a single "Job Hunt" board with five fixed columns (Wish List, Applied, Interviewing, Offer, Rejected). Cards are dragged between columns with optimistic updates and persisted through server actions.

## Stack

| Concern       | Choice                                                |
| ------------- | ----------------------------------------------------- |
| Framework     | Next.js 16.2 (App Router, Turbopack)                  |
| Auth          | Better Auth 1.6 with the MongoDB adapter              |
| Database      | MongoDB Atlas + Mongoose 9                            |
| UI            | Base UI primitives, shadcn-style wrappers, Tailwind 4 |
| Drag and drop | dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`)        |

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

Create a `.env` in the project root:

```bash
MONGODB_URI=          # mongodb+srv connection string
BETTER_AUTH_SECRET=   # random 32+ char string
BETTER_AUTH_URL=      # http://localhost:3000 in development
SEED_USER_ID=         # optional, see Seeding
```

`.env` is gitignored and holds live credentials. Keep it out of version control.

### Scripts

| Command      | Purpose                                     |
| ------------ | ------------------------------------------- |
| `pnpm dev`   | Development server                          |
| `pnpm build` | Production build (typechecks as part of it) |
| `pnpm lint`  | eslint                                      |
| `pnpm seed`  | Populate the database with 15 sample cards  |

### Seeding

```bash
pnpm seed                        # seeds the default user
SEED_USER_ID=<id> pnpm seed      # seeds a specific user
```

The script is destructive by design: it deletes every job application belonging to
the target user before reinserting, so anything created through the UI is
discarded. It's idempotent, so re-running is safe. A board must already exist for
the user, and one is created if it doesn't.

## How it works

### Data model

```
Board  ──> Column[]          (board.columns holds column refs)
Column <── JobApplication    (job.columnId points at its column)
```

Columns are referenced from the board, but cards are **not** referenced from
columns. A card's membership is defined solely by `JobApplication.columnId`,
which is indexed. That makes moving a card a single-document write and removes
any possibility of a ref array drifting out of sync with the documents. The
dashboard assembles the nested shape the client needs in `getBoard`.

### Card ordering

Positions are fractional sort keys, not indexes. Dropping a card between two
neighbours writes the midpoint of their `order` values:

```
neighbours 1000 and 2000  ->  new order 1500
```

Only the moved card is written. Because the value is absolute rather than
relative, the write is idempotent and safe to retry. New cards append at
`last + 1000`; an empty column starts at `1000`.

Repeatedly dropping into the same slot halves the gap each time, which float64
tolerates for about 50 inserts. When the gap falls below `MIN_ORDER_GAP`, that
column's keys are rewritten to clean `1000` spacing in a single `bulkWrite`.
See `lib/helpers/fractional-order.ts` and `lib/database/functions/position-job.ts`.

### Authorization

Two layers, and only one of them is load-bearing:

- **`proxy.ts`** (Next 16's rename of `middleware.ts`) handles optimistic
  redirects. It is a UX convenience, not a security boundary.
- **Page and server action checks** are the real boundary. Every server action in
  `lib/actions/` calls `getSession()` and verifies `userId` ownership before
  touching a document, and `/dashboard` redirects unauthenticated requests.

Deleting `proxy.ts` would not expose any data.

### Cache Components

`cacheComponents: true` is enabled in `next.config.ts`, which the `"use cache"`
directive in `getBoard` requires. The consequence is that any component reading
request-time data must sit inside a `<Suspense>` boundary, which is why `NavBar`
is wrapped in `app/layout.tsx` with a static `NavBarShell` fallback. All routes
partial-prerender as a result.

### Error handling

`lib/helpers/tryCatch.ts` converts a rejecting promise into a `{ data, error }`
result. Note that server actions have two failure channels: they throw on
infrastructure problems and return `{ error }` for expected failures like
`"Unauthorized"`. Client callers check both. `useBoard` snapshots column state
before an optimistic move and restores it if either channel reports failure.

## Project layout

```
app/
  (auth)/            sign-in, sign-up
  api/auth/[...all]/ Better Auth handler
  dashboard/         board page, getBoard query
components/          KanbanBoard, cards, dialogs, ui/ primitives
lib/
  actions/           server actions (create/update/delete cards)
  auth/              Better Auth server + client config
  database/          connection cache, board init, card positioning
  helpers/           tryCatch, fractional ordering
  hooks/             useBoard (optimistic state)
  models/            Mongoose schemas + client DTO types
scripts/seed.ts      sample data
proxy.ts             optimistic redirects
```

## Known gaps

- Board creation happens only in the Better Auth signup hook. If it fails, the
  hook logs and signup still succeeds, but the user lands on a dashboard with no
  board and no recovery path. Lazy initialization on dashboard read would close
  this.
- Cross-column moves are atomic (one write), but renormalization is a
  `bulkWrite` that isn't wrapped in a transaction. It is idempotent, so a retry
  converges.
- Moving a card between columns does not update its `status` field.
- Card edit, delete, and move-menu failures log to the console rather than
  surfacing in the UI. Only drag failures show a message.
- Column create and delete are not implemented; the delete menu item is inert.
