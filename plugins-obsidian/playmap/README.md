# Play Map for Obsidian

Play Map is an optional Obsidian companion plugin for Docs Viewer.

It lets you inspect and manage roadmap data directly inside the same Obsidian vault that Docs Viewer later publishes as a read-only web experience.

## Relationship to Docs Viewer

Both tools use the same source of truth:

```text
markdown files + YAML frontmatter
```

The workflow is:

```text
Obsidian vault
  -> edit markdown notes
  -> manage roadmap dates/status/scopes with Play Map
  -> run npm run build:index in Docs Viewer
  -> publish the same docs and roadmap in the web viewer
```

The web side lives in:

```text
plugins/roadmap/
viewer/plugins/roadmap/
```

The sample vault lives in:

```text
docs-sample/04-Roadmap-Sample/
```

## Install Locally

Copy this folder into your Obsidian vault:

```text
.obsidian/plugins/playmap
```

Then enable **Play Map** in Obsidian settings.

In this repository, the source folder is:

```text
plugins-obsidian/playmap
```

`plugins-obsidian/` is a catalog for Obsidian companion plugins. Each plugin should live in its own folder so users can copy only the plugin they need.

## Plugin Files

```text
plugins-obsidian/
└── playmap/
    ├── manifest.json
    ├── main.js
    ├── styles.css
    ├── data.json
    └── README.md
```

`data.json` contains local default settings. For the sample vault, it scans:

```text
docs-sample/04-Roadmap-Sample
```

In a real vault, point the setting at whichever folders contain roadmap feature notes.

## Roadmap Model

Play Map derives the roadmap from markdown files and folders:

- folders become roadmap groups;
- nested folders become nested groups;
- index-like files are group pages, not feature cards;
- regular markdown files become features;
- frontmatter `scopes` create multiple roadmap items from one note.

Index-like files include:

- `index.md`;
- `Folder/Folder.md`;
- `01-Folder/Folder.md`, where numeric prefixes are ignored.

## Frontmatter

```yaml
---
title: Viewer UX
status: planned
roadmap_start: 2026-07-15
roadmap_end: 2026-08-28
---
```

Supported status values:

- `backlog`
- `todo`
- `planned`
- `in-progress`
- `blocked`
- `done`

Date aliases:

- Start: `roadmap_start`, `start`, `starts`, `start_date`, `date_start`, `target_start`
- End: `roadmap_end`, `end`, `ends`, `end_date`, `date_end`, `target_end`, `due`

## Scopes

Use `scopes` when one feature note needs multiple roadmap bars or board cards:

```yaml
scopes:
  - title: Web plugin registry
    status: backlog
    roadmap_start: 2026-11-02
    roadmap_end: 2026-11-20
  - title: Shared roadmap model
    status: todo
    roadmap_start: 2026-11-23
    roadmap_end: 2026-12-04
```

Play Map includes commands for editing scopes because YAML arrays can be awkward in Obsidian's metadata UI:

```text
Add scope to current note
Edit scopes in current note
```

## Views

- Timeline: roadmap/Gantt-style planning by date.
- Board: status columns grouped by `status`.

Timeline supports moving and resizing dated items. Board supports moving cards between status columns.

## Why This Is Separate From Viewer Plugins

`plugins-obsidian/` is a catalog for local Obsidian plugins. `plugins-obsidian/playmap/` is the Play Map plugin folder that can be copied into `.obsidian/plugins/playmap/`.

`plugins/` is for Docs Viewer plugins.

Keeping them separate avoids confusion while still keeping both implementations in one repository. They can share the same markdown/frontmatter contract and sample data without pretending to run in the same runtime.
