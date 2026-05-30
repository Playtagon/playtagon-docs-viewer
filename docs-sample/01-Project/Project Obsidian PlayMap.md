---
title: Obsidian PlayMap
description: How the Obsidian PlayMap companion plugin fits into the Docs Viewer workflow.
aliases:
  - Obsidian Play Map
  - Play Map
tags:
  - project
  - obsidian
  - roadmap
author: ""
date: 2026-05-29
category: 01-Project
featured: false
image: ""
logo: ""
metrics: ""
status: planned
---
# Obsidian PlayMap

PlayMap is the Obsidian companion plugin for the roadmap workflow.

Docs Viewer publishes markdown as a read-only web experience. PlayMap runs locally inside Obsidian, where authors already edit the same markdown files.

## Why it exists

The roadmap is stored in page frontmatter:

```yaml
status: planned
roadmap_start: 2026-07-15
roadmap_end: 2026-08-28
```

That means the data remains portable markdown, but editing dates, statuses, and scopes by hand can be tedious. PlayMap gives the vault a local timeline and board view without introducing a separate roadmap database.

## Repository layout

| Path | Purpose                                           |
| --- | --- |
| `plugins-obsidian/` | Catalog for Obsidian companion plugins            |
| `plugins-obsidian/playmap/` | Obsidian PlayMap plugin folder                    |
| `plugins/roadmap/` | Docs Viewer roadmap plugin source                 |
| `viewer/plugins/roadmap/` | Browser-served copy used by the static viewer     |
| `docs-sample/04-Roadmap-Sample/` | Sample notes that both implementations understand |

Users should copy the specific plugin folder:

```text
plugins-obsidian/playmap/ -> .obsidian/plugins/playmap/
```

## Workflow

```text
Obsidian
  -> edit notes and roadmap fields with PlayMap
  -> run npm run build:index
  -> publish viewer/
  -> readers open #/roadmap in Docs Viewer
```

## When to split repositories

Keeping PlayMap in this repository is useful while the markdown/frontmatter contract is still evolving.

A separate repository makes sense once PlayMap needs independent versioning, release notes, issue tracking, or publication as an Obsidian community plugin.

## When changing this page, check

- [[Project Runtime|Runtime]], if the viewer plugin boundary changes.
- [[Roadmap Sample|Roadmap Sample]], if sample roadmap fields change.
- `plugins-obsidian/playmap/README.md`, if the Obsidian plugin workflow changes.
