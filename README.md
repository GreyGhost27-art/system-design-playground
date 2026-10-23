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

- **Start from:** pick _Empty board (free mode)_ or one of the templates. A
  template loads an example design with a _Learn why_ panel explaining the
  problem it solves. Templates are only starting points; edit them freely.
  The URL remembers the template (`#chat-app`), so it can be shared.
- **Add a component:** drag it from the sidebar onto the board, or click it.
- **Connect:** hover a component to reveal its ports, then drag from a port.
  The cable snaps to the nearest port in reach, or to the closest port of the
  component you drop it on. Two components can be connected only once.
- **Select / delete:** click a component or cable, then press `Delete`.
- **Navigate:** scroll to zoom, drag empty space to pan.
- **Show traffic:** a gentle ripple runs along each cable from caller to
  callee, and another ripple comes back as the response.
- **Copy board as JSON:** copies the board in template format, the easiest
  way to start a new template.

## Configuration

Everything content-related lives in JSON, so no code changes are needed to
add components or templates.

### Components — `src/components.json`

`categories` set the sidebar groups and colours; `components` list what can
be placed:

```json
{ "id": "cache", "label": "Cache", "badge": "CA", "category": "data" }
```

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

- `kind` is a component `id` from `components.json`; `label` is optional and
  renames that one component (the type is shown underneath).
- `x`/`y` are the component's centre. Columns 250 apart and rows 120–140
  apart keep cables and labels readable.
- Cable ends are `nodeId.side`, where side is `top`, `right`, `bottom` or
  `left`. Cable `label`s and `groups` are optional.
- `npm test` checks every template: unknown kinds, missing nodes, bad sides
  and duplicate cables are reported by name.

## Structure

| File                     | Responsibility                                      |
| ------------------------ | --------------------------------------------------- |
| `src/main.ts`            | Wires input, the template picker and the lesson     |
| `src/design.ts`          | The design model: components, ports, cables, groups |
| `src/templates.ts`       | Validating, loading and exporting templates         |
| `src/templateLibrary.ts` | Collects the JSON files in `src/templates/`         |
| `src/lesson.ts`          | The _Learn why_ panel                               |
| `src/rope.ts`            | Verlet rope physics for cables                      |
| `src/flow.ts`            | The ripple that runs along cables                   |
| `src/snap.ts`            | Finding the port under the pointer and snap targets |
| `src/camera.ts`          | Pan, zoom and fitting a design in view              |
| `src/components.ts`      | Reads the component catalogue                       |
| `src/render.ts`          | Drawing the board on a canvas                       |
| `src/palette.ts`         | The sidebar of components                           |
| `src/geometry.ts`        | Small point and distance helpers                    |

## Tests

Tests use Node's built-in runner (Node 22.18+ runs TypeScript directly), so
they need no extra packages.

```sh
npm test                          # everything
node --test src/rope.test.ts      # one file
```

| Source file                                                                                 | Test file                                              |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `src/rope.ts`                                                                               | `src/rope.test.ts`                                     |
| `src/flow.ts`, `src/settings.json`                                                          | `src/flow.test.ts`                                     |
| `src/design.ts`                                                                             | `src/design.test.ts`                                   |
| `src/snap.ts`                                                                               | `src/snap.test.ts`                                     |
| `src/camera.ts`                                                                             | `src/camera.test.ts`                                   |
| `src/templates.ts`, `src/templates/*.json`, `src/components.json`, `src/components.ts`      | `src/templates.test.ts`                                |
| `src/geometry.ts`                                                                           | covered by `src/rope.test.ts` and `src/design.test.ts` |
| `src/render.ts`, `src/main.ts`, `src/palette.ts`, `src/lesson.ts`, `src/templateLibrary.ts` | no unit tests; check in the browser                    |
