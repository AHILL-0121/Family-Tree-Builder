# Family Tree Builder — frontend

Next.js 14 (App Router) · TypeScript · Tailwind · d3-zoom · IndexedDB (idb-keyval) · zod · Vitest.

## Structure

```
app/
  page.tsx               Landing page (live relationship demo, poster preview, contact)
  editor/page.tsx        Editor route → components/editor/EditorApp
  api/contact/route.ts   Contact form: zod validation, HTML escaping, rate limit, honeypot
  layout.tsx             Fonts (Geist, Newsreader, Noto Serif Tamil), theme bootstrap, metadata
  globals.css            "Register" design tokens (light + dark), poster preview styles

components/
  editor/
    EditorApp.tsx        State, modes (Tree · Descendants · Relate), shortcuts, import/export
    FamilyCanvas.tsx     SVG canvas: d3-zoom camera, pointer drag, quick-add handles, keyboard nav
    Inspector.tsx        Side panel: overview / person / edit / new person / relate
    PeopleRail.tsx       Searchable people list grouped by generation
    Dock.tsx             Mode switch, undo/redo, zoom, fit
    CommandPalette.tsx   Ctrl K
    PosterPanel.tsx      Poster preview + PNG / SVG / print export
    EmptyState.tsx
  landing/RelateDemo.tsx
  PersonForm.tsx         Full edit form (parents, marriages, photo, notes)
  ImageCropper.tsx       Crops avatars to ≤256 px WebP
  ui/                    shadcn primitives (button, dialog, input, label, select, toast)

lib/
  graph.ts               Relationship-safe reducer + normalize() + undo/redo history
  relationships.ts       BFS shortest path → kinship signature → English/Tamil terms
  layout.ts              Shared family layout (generations, tidy tree, connectors)
  poster.ts              Pure poster SVG builder (Register + Illustrated)
  poster-fonts.ts        Inlines the page's fonts into exported files
  json-schema.ts         Import (zod, migrations, report) and export
  storage.ts             IndexedDB autosave
  cycles.ts, avatar.ts, id.ts, io.ts, sample.ts, person-display.ts, contact.ts, types.ts

hooks/
  use-family-tree.ts     Reducer + history + autosave
  use-local-setting.ts   Tree name, theme
```

## Data rules

Every change goes through `graphReducer` in `lib/graph.ts`, which returns a normalized list: parents ≤ 2 and never cyclic, `childIds` derived from `parentIds`, spouses and marriage records mirrored on both people. Imports run through the same `normalize()` and report what they repaired.

## Tests

`npm test` covers the reducer, import/migration, cycle detection, the layout, the poster builder and a golden table of 59 relationships (both directions, both speaker genders, elder/younger, half-siblings).
