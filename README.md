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

- **Add a component:** drag it from the sidebar onto the board, or click it.
- **Connect:** hover a component to reveal its ports, then drag from a port.
  The cable snaps to the nearest port in reach, or to the closest port of the
  component you drop it on. Two components can be connected only once.
- **Select / delete:** click a component or cable, then press `Delete`.
- **Navigate:** scroll to zoom, drag empty space to pan.

## Structure

| File                 | Responsibility                                       |
| -------------------- | ---------------------------------------------------- |
| `src/main.ts`        | Wires input (pointer, drag & drop, keys) to the board |
| `src/design.ts`      | The design model: components, ports and cables       |
| `src/rope.ts`        | Verlet rope physics for cables                       |
| `src/snap.ts`        | Finding the port under the pointer and snap targets  |
| `src/camera.ts`      | Pan and zoom                                         |
| `src/components.ts`  | Catalogue of component kinds and categories          |
| `src/render.ts`      | Drawing the board on a canvas                        |
| `src/palette.ts`     | The sidebar of components                            |
| `src/geometry.ts`    | Small point and distance helpers                     |

## Tests

Tests use Node's built-in runner (Node 22.18+ runs TypeScript directly), so
they need no extra packages.

```sh
npm test                          # everything
node --test src/rope.test.ts      # one file
```

| Source file         | Test file                |
| ------------------- | ------------------------ |
| `src/rope.ts`       | `src/rope.test.ts`       |
| `src/design.ts`     | `src/design.test.ts`     |
| `src/snap.ts`       | `src/snap.test.ts`       |
| `src/camera.ts`     | `src/camera.test.ts`     |
| `src/geometry.ts`   | covered by `src/rope.test.ts` and `src/design.test.ts` |
| `src/render.ts`, `src/main.ts`, `src/palette.ts`, `src/components.ts` | no unit tests; check in the browser |
