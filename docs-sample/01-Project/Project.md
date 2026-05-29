---
title: "Project"
description: "How the docs viewer works."
aliases:
  - "Project"
tags:
  - "project"
  - "architecture"
author: ""
date: "2026-05-26"
category: "01-Project"
featured: true
image: ""
logo: ""
metrics: ""
status: "done"
---
# Project

Docs Viewer is a lightweight web client for Obsidian-style documentation. It reads a markdown vault, builds a JSON index, and renders docs in the browser without a heavy frontend framework.

## Project parts

| Part | Path | Role |
| --- | --- | --- |
| Source vault | `docs-sample/` or your own vault | Markdown files, frontmatter, wikilinks, and assets |
| Build script | `scripts/build_viewer_index.mjs` | Builds pages, links, aliases, backlinks, and folder tree |
| Runtime server | `scripts/dev_server.mjs` | Serves the viewer, auth, and server endpoints |
| Static viewer | `viewer/` | HTML, CSS, JS, and `data/vault-index.json` |
| Viewer plugins | `plugins/` | Source files for viewer extensions such as Roadmap |
| Obsidian plugins | `plugins-obsidian/` | Catalog for local Obsidian companion plugins |
| Play Map | `plugins-obsidian/playmap/` | Obsidian roadmap plugin folder users can copy into a vault |
| Config | `docs-viewer.config.json` | Selects the source and ignored folders |

## Main flow

```text
markdown vault
  -> scripts/build_viewer_index.mjs
  -> viewer/data/vault-index.json
  -> viewer/app.js
  -> browser UI
```

## Sections

- [[Project-Architecture|Architecture]] - layers and responsibilities.
- [[Project-Index-Build|Index build]] - how markdown becomes JSON.
- [[Project-Runtime|Runtime]] - what the browser UI and Node server do.
- [[Project-Obsidian-Play-Map|Obsidian Play Map]] - how the local Obsidian plugin fits into the workflow.

## When changing this page, check

- [[Project-Architecture|Architecture]], if layer boundaries change.
- [[Project-Index-Build|Index build]], if the `vault-index.json` format changes.
- [[Project-Runtime|Runtime]], if server or browser behavior changes.
- [[Project-Obsidian-Play-Map|Obsidian Play Map]], if plugin organization changes.
