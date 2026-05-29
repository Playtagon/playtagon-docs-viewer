# Roadmap Viewer Plugin

Roadmap is the built-in viewer plugin that renders `#/roadmap` from the same markdown/frontmatter contract used by the Obsidian Play Map companion plugin.

This plugin is read-only in the web viewer. It does not edit markdown files; it reads the generated `viewer/data/vault-index.json` and turns selected pages into a timeline and board.

## Relationship to Obsidian Play Map

- `plugins/roadmap/` contains the viewer-side roadmap model.
- `plugins-obsidian/playmap/` contains the Obsidian Play Map plugin for editing and viewing the same roadmap inside Obsidian.
- `docs-sample/04-Roadmap-Sample/` contains sample markdown data that both sides understand.

The intended workflow:

```text
Obsidian vault
  -> edit notes and roadmap fields with Play Map
  -> npm run build:index
  -> Docs Viewer renders the same roadmap at #/roadmap
```

## Source and Static Copy

The source file is:

```text
plugins/roadmap/model.js
```

For static hosting, the build step copies viewer plugins into:

```text
viewer/plugins/
```

The browser imports the copied file from `viewer/plugins/roadmap/model.js`.

## Config

The viewer roadmap is controlled by `docs-viewer.config.json`:

```json
{
  "roadmap": {
    "includedFolders": ["04-Roadmap-Sample"],
    "excludedFolders": [],
    "hideUndated": false
  }
}
```

`includedFolders` is an explicit allowlist. Leave it empty if the roadmap should scan the full vault.

## Frontmatter

```yaml
status: planned
roadmap_start: 2026-06-01
roadmap_end: 2026-06-14
```

Supported status values:

- `backlog`
- `todo`
- `planned`
- `in-progress`
- `blocked`
- `done`

Supported date aliases:

- Start: `roadmap_start`, `start`, `starts`, `start_date`, `date_start`, `target_start`
- End: `roadmap_end`, `end`, `ends`, `end_date`, `date_end`, `target_end`, `due`

## Scopes

Use `scopes` when one markdown page should produce multiple roadmap items:

```yaml
status: planned
scopes:
  - title: MVP
    status: in-progress
    roadmap_start: 2026-06-01
    roadmap_end: 2026-06-14
  - title: Public release
    status: planned
    roadmap_start: 2026-06-15
    roadmap_end: 2026-06-30
```

If a feature has no `scopes`, the feature itself becomes one roadmap item. If it has `scopes`, each scope becomes its own item while still opening the same parent markdown page.
