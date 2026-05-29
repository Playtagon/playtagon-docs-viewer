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

## Useful markdown conventions

- Give every page a clear `title`.
- Use `aliases` for readable navigation.
- Escape wikilink aliases inside tables: `[[Page\|Alias]]`.
- End pages with an impact block such as `## When changing this page, check`.

## When changing this page, check

- [[Project-Runtime|Runtime]], if the UI data shape changes.
- [[Operations-Update-Docs|Update docs]], if the build command changes.
- [[Operations-Troubleshooting|Troubleshooting]], if new common errors appear.
