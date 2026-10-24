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
  `src/nutshell.json`; each common signal links to its Foundation board.
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
- **Move a group:** drag a dashed area such as _EU region_ by its name. Every
  component inside it, or overlapping its edge, moves along; dragging its
  empty middle still pans the board.
- **Copy & paste:** select a component and press `Ctrl+C`, then `Ctrl+V`
  for each copy (`Cmd` on macOS). Copies keep the name and land diagonally
  below the original.
- **Undo:** `Ctrl+Z` reverses the last change (adding, moving, connecting,
  pasting or deleting), up to 100 steps. Opening a template starts afresh.
- **Navigate:** scroll to zoom, drag empty space to pan.
- **Show traffic:** a gentle ripple runs along each cable from caller to
  callee, and another ripple comes back as the response.
- **Copy board as JSON:** copies the board in template format, the easiest
  way to start a new template.

## Configuration

Everything content-related lives in JSON, so no code changes are needed to
add components or templates.

### Components — `src/components/`

Each component is its own file, so several people can work on them without
stepping on each other:

```
src/components/
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

`info.samples` shows what a component looks like in practice,
under _What it looks like_ in the drawer. Each sample is a small table or a
code snippet:

```json
{ "type": "table", "caption": "users", "columns": ["id", "name"], "rows": [["1", "Ana"]] }
{ "type": "code", "caption": "Find a user", "language": "sql", "code": "SELECT * FROM users;" }
```

Code lines must be 40 characters or fewer so they fit the drawer (a test
checks). Every component has at least one sample (a test checks).

### Traffic flow — `src/settings.json`

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

### Templates — `src/templates/*.json`

Every JSON file in `src/templates/` is a template; the file name sets its
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

- `kind` is a component `id` from `src/components/`; `label` is optional and
  renames that one component (the type is shown underneath).
- `x`/`y` are the component's centre. Columns 250 apart and rows 120–140
  apart keep cables and labels readable.
- Cable ends are `nodeId.side`, where side is `top`, `right`, `bottom` or
  `left`. Cable `label`s and `groups` are optional.
- `"oneWay": true` marks a cable whose traffic gets no response, such as a
  task put on a queue or database replication. It shows a single wave and an
  arrow. On the board, click a cable to switch it, flip it or label it.
- `npm test` checks every template: unknown kinds, missing nodes, bad sides
  and duplicate cables are reported by name.

### Foundations — `src/templates/foundations/*.json`

Foundations use the same format as templates and appear in their own group,
above Templates. Each one answers a foundational question as part of one
story: Marmita, a fictional lunch-delivery startup that grows from a single
server. `title` is the question, `summary` the short answer, `problem` the
story so far, `why` what the team did, and `takeaways` the lessons. Ids must
be unique across templates and foundations (a test checks).

## Structure

| File                     | Responsibility                                      |
| ------------------------ | --------------------------------------------------- |
| `src/main.ts`            | Wires input, the template picker and the lesson     |
| `src/design.ts`          | The design model: components, ports, cables, groups |
| `src/history.ts`         | Undo steps                                          |
| `src/labelEditor.ts`     | The text field for naming a cable                   |
| `src/cableToolbar.ts`    | The options wheel over a selected cable             |
| `src/radialMenu.ts`      | Cuts a menu's buttons into slices of a wheel        |
| `src/templates.ts`       | Validating, loading and exporting templates         |
| `src/templateLibrary.ts` | Collects the Foundations and Templates sections     |
| `src/lesson.ts`          | The template lesson shown in the drawer             |
| `src/nutshell.ts`        | The _In a nutshell_ page, from `nutshell.json`      |
| `src/componentInfo.ts`   | The component explanation shown in the drawer       |
| `src/dom.ts`             | Tiny helpers for building drawer content            |
| `src/rope.ts`            | Verlet rope physics for cables                      |
| `src/flow.ts`            | The ripple that runs along cables                   |
| `src/snap.ts`            | Finding the port under the pointer and snap targets |
| `src/camera.ts`          | Pan, zoom and fitting a design in view              |
| `src/components.ts`      | Reads the component catalogue in `src/components/`  |
| `src/render.ts`          | Drawing the board on a canvas                       |
| `src/palette.ts`         | The sidebar of components                           |
| `src/geometry.ts`        | Small point and distance helpers                    |

## Tests

Tests live in `tests/` and use Node's built-in runner (Node 22.18+ runs
TypeScript directly), so they need no extra packages.

```sh
npm test                          # everything
node --test tests/rope.test.ts    # one file
```

| Source file                                                                                                                                                                    | Test file                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `src/radialMenu.ts`                                                                                                                                                            | `tests/radialMenu.test.ts`                                 |
| `src/rope.ts`                                                                                                                                                                  | `tests/rope.test.ts`                                       |
| `src/flow.ts`, `src/settings.json`                                                                                                                                             | `tests/flow.test.ts`                                       |
| `src/design.ts`                                                                                                                                                                | `tests/design.test.ts`                                     |
| `src/history.ts`                                                                                                                                                               | `tests/history.test.ts`                                    |
| `src/snap.ts`                                                                                                                                                                  | `tests/snap.test.ts`                                       |
| `src/camera.ts`                                                                                                                                                                | `tests/camera.test.ts`                                     |
| `src/nutshell.ts`, `src/nutshell.json`                                                                                                                                         | `tests/nutshell.test.ts`                                   |
| `src/templates.ts`, `src/templates/**/*.json`                                                                                                                                  | `tests/templates.test.ts`                                  |
| `src/components.ts`, `src/components/**`                                                                                                                                       | `tests/components.test.ts`, `tests/templates.test.ts`      |
| `src/geometry.ts`                                                                                                                                                              | covered by `tests/rope.test.ts` and `tests/design.test.ts` |
| `src/render.ts`, `src/main.ts`, `src/palette.ts`, `src/lesson.ts`, `src/componentInfo.ts`, `src/dom.ts`, `src/labelEditor.ts`, `src/cableToolbar.ts`, `src/templateLibrary.ts` | no unit tests; check in the browser                        |
