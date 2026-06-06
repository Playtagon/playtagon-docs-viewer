---
title: "Index Build"
description: "How the build script turns a markdown vault into vault-index.json."
aliases:
  - "Index build"
tags:
  - "project"
  - "build"
author: ""
date: "2026-05-26"
category: "01-Project"
featured: false
image: ""
logo: ""
metrics: ""
status: "done"
---
# Index Build

Build the index with:

```bash
npm run build:index
```

By default, the script reads the source from `docs-viewer.config.json`:

```json
{
  "source": {
    "type": "local",
    "local": {
      "path": "docs-sample"
    }
  }
}
```

You can also pass the source and output paths explicitly:

```bash
node scripts/build_viewer_index.mjs docs-sample viewer/data/vault-index.json
```

## What goes into the index

- markdown pages;
- page frontmatter;
- body without frontmatter;
- headings;
- wikilinks such as `[[Page]]` and `[[Page|Alias]]`;
- backlinks;
- aliases;
- folder tree;
- copied assets.
- active theme;
- available theme catalog.

## Themes in the build

The build reads theme JSON files from `theme.directory`, selects `theme.active`, and writes the resolved theme into `viewer/data/vault-index.json`.

The index also includes a catalog of available themes so the browser can preview bundled themes without another rebuild. See [[Project Themes|Themes]] for token groups and fallback behavior.

## Useful markdown conventions

- Give every page a clear `title`.
- Use `aliases` for readable navigation.
- Escape wikilink aliases inside tables: `[[Page\|Alias]]`.
- End pages with an impact block such as `## When changing this page, check`.

## When changing this page, check

- [[Project Runtime|Runtime]], if the UI data shape changes.
- [[Project Themes|Themes]], if theme data or fallback behavior changes.
- [[Operations Update Docs|Update docs]], if the build command changes.
- [[Operations Themes|Theme operations]], if the rebuild workflow for themes changes.
- [[Operations Troubleshooting|Troubleshooting]], if new common errors appear.
