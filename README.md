# System Design Playground

An interactive board for building system designs: drop components (clients,
load balancers, servers, databases, queues…) and wire them together with
cables that hang and swing with simple rope physics.

## Running

```sh
npm install
npm run dev
```

## Using the board

- **Start from:** pick _Blank board_ or one of the templates. A template
  loads an example design with a _Learn why_ panel explaining the problem it
  solves. Templates are only starting points; edit them freely.
- **＋ Blank board** (top left of the board) clears it in one click; the
  _Undo_ message that follows brings everything back.
- **In a nutshell** (top of the sidebar) is a one-page summary: why and when
  to think about system design, the constraints to list first, and the
  questions to ask before adding a component. Its content is in
  `src/content/nutshell.json`; each common signal links to its Foundation board.
  The URL remembers the template (`#chat-app`), so it can be shared.
- **Add a component:** drag it from the sidebar onto the board, or click it.
- **Connect:** hover a component to reveal its ports, then drag from a port.
  The cable snaps to the nearest port in reach, or to the closest port of the
  component you drop it on. Two components can be connected only once.
- **Unplug a cable:** grab a cable close to either end and drag, or
  `Shift`+drag a port to pick up its newest cable. Drop it on empty board to
  detach it, or on another port to plug it in there; it keeps its label and
  direction. `Ctrl+Z` plugs it back.
- **Label a cable:** double-click it (or long-press on touch screens), type
  and press `Enter`. `Esc` cancels; an empty label removes it.
- **Learn a component:** select it and press _Info_ in the wheel above it (or
  double-click it). The drawer explains it in plain words: what it is, why
  it's used, an everyday comparison and three well-known examples. Close it
  to return to the lesson.
- **Select / delete:** click a component or cable, then press `Delete` or
  use the wheel of options that fans out above it (components can also be
  duplicated there).
- **Add a group:** press _Draw a group_ at the top of the board, then drag an area
  (or tap to place one) and type its name. Tap a group's name to open its
  wheel: _Rename_, _Resize_ (drag any corner handle) or _Delete_ (its
  components stay on the board). Double-clicking the name, or holding it on
  touch screens, renames it directly.
- **Move a group:** drag a dashed area such as _EU region_ by its name. Every
  component inside it, or overlapping its edge, moves along; dragging its
  empty middle still pans the board.
- **Copy & paste:** select a component and press `Ctrl+C`, then `Ctrl+V`
  for each copy (`Cmd` on macOS). Copies keep the name and land diagonally
  below the original.
- **Undo:** `Ctrl+Z` reverses the last change (adding, moving, connecting,
  pasting or deleting), up to 100 steps. Opening a template starts afresh.
- **Navigate:** scroll to zoom, drag empty space to pan.
- **How many users?** Click a client and choose _Users_: 10, 1,000, 100,000,
  1 million or 10 million people using it each day (daily active users, the
  number interviews start from). Each makes about 50 requests a day, so
  1 million users send about 580 requests a second. Their traffic follows the
  cables and every
  component shows how busy it gets with a slim bar (green, amber at 75%, red
  when over its capacity, with _Busy_ / _Too busy_ in words). A dot on the
  client shows how its users are doing: green ✓ fast, orange ! slow, red ✕
  errors, or orange … delayed: answers are fast but something behind a queue,
  stream or pub/sub can't keep up, so background work (emails, updates)
  arrives late. Work behind those never fails users directly. A legend in the corner of the board explains both; it shows with
  _Show traffic_ and folds away.
- **Worst day:** a switch under _Show traffic_. It simulates a rush: 3× the
  traffic, and 4 database queries per request (real pages make several), so
  databases take 12× their average load while app servers take 3×. Every
  template struggles at 1 million users; beating it takes more servers _and_
  a cache, replicas or sharding. The legend says when it's on.
- **Status at a glance:** while traffic is shown, a selected component has a
  small chip above it with three short lines: how full it is ("**Too busy** ·
  143% of what it can handle"), what's going on ("Receiving 1,000 requests a
  second; it can handle about 700."), and what that means, with a tip ("About
  300 a second more than it can take, so some requests fail. Tip: add a copy
  (see Fix)."). A client shows its users, the requests they send and its
  weakest link.
- **Fix what's busy:** a busy or too-busy component, or a client whose users
  are slow or delayed, gets a _Fix_ option in its wheel. It says why, in the board's own
  numbers ("It's receiving about 1,000 requests a second; one App Server can
  handle about 700"), and lists what to try, best first. _Add a copy_ works in
  one click: a new box appears below, numbered ("App Server 2") and wired like
  the original. The rest link to the board that teaches them (in a new tab). A
  client's Fix points at its weakest link, with _Show me_ to jump there.
  Suggestions live in `src/content/fixes.json`; only fixes the board can show working
  are listed.
- **Show traffic:** a gentle ripple runs along each cable from caller to
  callee, and another ripple comes back as the response.
- **Export / import:** _Export_ downloads the board as a `.json` file
  (the template format). To bring one back, drop the file onto the board (it
  lights up when it's ready to receive it) or use _Import_. Files are
  checked first: a bad one is rejected with the reason and the board stays as
  it was. An import replaces the board and can be undone.
- **Copy board as JSON:** copies the board in template format, the easiest
  way to start a new template.

## Configuration

Everything content-related lives in JSON, so no code changes are needed to
add components or templates.

### Components — `src/content/components/`

Each component is its own file, so several people can work on them without
stepping on each other:

```
src/content/components/
  categories.json          sidebar groups, their order and colours
  index.ts                 lists every component file, in sidebar order
  data/cache.json          one file per component, in its category folder
  data/sql-database.json
  …
```

A component file holds what can be placed and the plain-language
explanation shown in the drawer:

```json
{
  "id": "cache",
  "label": "Cache",
  "badge": "CA",
  "category": "data",
  "capacity": 100000,
  "info": {
    "what": "Keeps frequently used data in fast memory.",
    "why": "Answers repeated questions quickly and takes load off the database.",
    "analogy": "Keeping the things you use most on your desk.",
    "examples": ["Redis", "Memcached", "Valkey"]
  }
}
```

To add a component, create `<category>/<id>.json` and add one import line to
`index.ts` where it should appear in the sidebar. Keep `info` short and
jargon-free. `npm test` checks that every file is listed, sits in the folder
of its category and is named after its `id`, and that every component has all
four parts of `info` and exactly three examples.

`capacity` is roughly how many requests a second one of these handles
before it gets too busy (every component except the client has one). Numbers
are rough on purpose: they exist to show where a design runs out of room.

`info.samples` shows what a component looks like in practice,
under _What it looks like_ in the drawer. Each sample is a small table or a
code snippet:

```json
{ "type": "table", "caption": "users", "columns": ["id", "name"], "rows": [["1", "Ana"]] }
{ "type": "code", "caption": "Find a user", "language": "sql", "code": "SELECT * FROM users;" }
```

Code lines must be 40 characters or fewer so they fit the drawer (a test
checks). Every component has at least one sample (a test checks).

### Traffic flow — `src/content/settings.json`

The `flow` section tunes the ripple that runs along cables: a request wave
runs from the cable's start to its end, then a response wave runs back.

| Setting         | Meaning                                               |
| --------------- | ----------------------------------------------------- |
| `enabled`       | Initial state of the _Show traffic_ toggle            |
| `speed`         | How fast a wave travels, in board units per second    |
| `amplitude`     | How far the cable bends sideways                      |
| `wavelength`    | Length of cable one wave covers                       |
| `ripples`       | Number of wiggles inside a wave                       |
| `pause`         | Seconds between the request arriving and the response |
| `rest`          | Seconds of stillness before the next exchange         |
| `showResponses` | Also send a wave back                                 |

A cable's direction is the order it was drawn in (or `from` → `to` in a
template), so draw cables from the caller to the component it calls.

### Templates — `src/content/templates/*.json`

Every JSON file in `src/content/templates/` is a template; the file name sets its
place in the list (`01-hello-world.json`, `02-…`).

```json
{
  "id": "hello-world",
  "title": "Hello World",
  "summary": "A client talks to a single server.",
  "lesson": {
    "problem": "What the design has to solve.",
    "why": ["One paragraph per idea."],
    "takeaways": ["Short, memorable points."]
  },
  "groups": [
    { "label": "EU region", "x": 0, "y": 0, "width": 500, "height": 400 }
  ],
  "nodes": [
    { "id": "client", "kind": "client", "label": "Browser", "x": 0, "y": 0 },
    { "id": "server", "kind": "app-server", "x": 250, "y": 0 }
  ],
  "cables": [{ "from": "client.right", "to": "server.left", "label": "HTTP" }]
}
```

- `kind` is a component `id` from `src/content/components/`; `label` is optional and
  renames that one component (the type is shown underneath).
- `x`/`y` are the component's centre. Columns 250 apart and rows 120–140
  apart keep cables and labels readable.
- Cable ends are `nodeId.side`, where side is `top`, `right`, `bottom` or
  `left`. Cable `label`s and `groups` are optional.
- A client can carry `"users": 100000` daily users (10, 1000, 100000, 1000000
  or 10000000); without it, a client stands for 1,000.
- `"oneWay": true` marks a cable whose traffic gets no response, such as a
  task put on a queue or database replication. It shows a single wave and a
  bright arrow; two-way cables show a faint arrow pointing from the caller.
  On the board, click a cable to switch it, flip it or label it.
- A cable from one database to another makes the second a replica: a server
  wired to both sends its writes to the primary and its reads to the replica,
  which also applies every write it is copied.
- `npm test` checks every template: unknown kinds, missing nodes, bad sides
  and duplicate cables are reported by name.

### Foundations — `src/content/templates/foundations/*.json`

Foundations use the same format as templates and appear in their own group,
above Templates. Each one answers a foundational question as part of one
story: Marmita, a fictional lunch-delivery startup that grows from a single
server. `title` is the question, `summary` the short answer, `problem` the
story so far, `why` what the team did, and `takeaways` the lessons. Ids must
be unique across templates and foundations (a test checks).

## Structure

`src/main.ts` wires everything together; the rest is grouped by job. Each
folder only uses the ones listed before it: content and the model are the
base, the simulation reads them, and the board and the UI show it all.

| Folder            | What lives there                                  |
| ----------------- | ------------------------------------------------- |
| `src/content/`    | Everything editable without code, and its readers |
| `src/model/`      | What a design is, and how it changes              |
| `src/simulation/` | How busy things get, and what to do about it      |
| `src/board/`      | The canvas: drawing, the camera, snapping         |
| `src/ui/`         | Panels, menus and drawers around the board        |

| File                             | Responsibility                                      |
| -------------------------------- | --------------------------------------------------- |
| `src/main.ts`                    | Wires input, the template picker and the lesson     |
| `src/content/components.ts`      | Reads the component catalogue in `components/`      |
| `src/content/templateLibrary.ts` | Collects the Foundations and Templates sections     |
| `src/model/design.ts`            | The design model: components, ports, cables, groups |
| `src/model/rope.ts`              | Verlet rope physics: each cable is a rope           |
| `src/model/history.ts`           | Undo steps                                          |
| `src/model/templates.ts`         | Validating, loading and exporting templates         |
| `src/model/geometry.ts`          | Small point and distance helpers                    |
| `src/simulation/load.ts`         | How busy each component gets for its users          |
| `src/simulation/status.ts`       | The status chip's words for a selected component    |
| `src/simulation/fixes.ts`        | What to try when a component is busy                |
| `src/board/render.ts`            | Drawing the board on a canvas                       |
| `src/board/flow.ts`              | The ripple that runs along cables                   |
| `src/board/snap.ts`              | Finding the port under the pointer and snap targets |
| `src/board/camera.ts`            | Pan, zoom and fitting a design in view              |
| `src/ui/palette.ts`              | The sidebar of components                           |
| `src/ui/radialMenu.ts`           | Cuts a menu's buttons into slices of a wheel        |
| `src/ui/cableToolbar.ts`         | The options wheel over a selected cable             |
| `src/ui/labelEditor.ts`          | The text field for naming cables and groups         |
| `src/ui/lesson.ts`               | The template lesson shown in the drawer             |
| `src/ui/fixCard.ts`              | The Fix card shown in the drawer                    |
| `src/ui/componentInfo.ts`        | The component explanation shown in the drawer       |
| `src/ui/nutshell.ts`             | The _In a nutshell_ page                            |
| `src/ui/dom.ts`                  | Tiny helpers for building drawer content            |

## Tests

Tests live in `tests/` and use Node's built-in runner (Node 22.18+ runs
TypeScript directly), so they need no extra packages.

```sh
npm test                          # everything
node --test tests/rope.test.ts    # one file
```

| Source file                                                                                                                                                                                                                         | Test file                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `src/simulation/load.ts`, component `capacity`                                                                                                                                                                                      | `tests/load.test.ts`, `tests/components.test.ts`           |
| `src/simulation/fixes.ts`, `src/content/fixes.json`                                                                                                                                                                                 | `tests/fixes.test.ts`                                      |
| `src/simulation/status.ts`                                                                                                                                                                                                          | `tests/status.test.ts`                                     |
| `src/ui/radialMenu.ts`                                                                                                                                                                                                              | `tests/radialMenu.test.ts`                                 |
| `src/model/rope.ts`                                                                                                                                                                                                                 | `tests/rope.test.ts`                                       |
| `src/board/flow.ts`, `src/content/settings.json`                                                                                                                                                                                    | `tests/flow.test.ts`                                       |
| `src/model/design.ts`                                                                                                                                                                                                               | `tests/design.test.ts`                                     |
| `src/model/history.ts`                                                                                                                                                                                                              | `tests/history.test.ts`                                    |
| `src/board/snap.ts`                                                                                                                                                                                                                 | `tests/snap.test.ts`                                       |
| `src/board/camera.ts`                                                                                                                                                                                                               | `tests/camera.test.ts`                                     |
| `src/ui/nutshell.ts`, `src/content/nutshell.json`                                                                                                                                                                                   | `tests/nutshell.test.ts`                                   |
| `src/model/templates.ts`, `src/content/templates/**/*.json`                                                                                                                                                                         | `tests/templates.test.ts`                                  |
| `src/content/components.ts`, `src/content/components/**`                                                                                                                                                                            | `tests/components.test.ts`, `tests/templates.test.ts`      |
| `src/model/geometry.ts`                                                                                                                                                                                                             | covered by `tests/rope.test.ts` and `tests/design.test.ts` |
| `src/board/render.ts`, `src/main.ts`, `src/ui/palette.ts`, `src/ui/lesson.ts`, `src/ui/componentInfo.ts`, `src/ui/dom.ts`, `src/ui/labelEditor.ts`, `src/ui/cableToolbar.ts`, `src/ui/fixCard.ts`, `src/content/templateLibrary.ts` | no unit tests; check in the browser                        |
