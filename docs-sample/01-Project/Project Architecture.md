---
title: "Architecture"
description: "Docs Viewer architecture: source vault, index builder, static runtime, and optional server."
aliases:
  - "Architecture"
tags:
  - "project"
  - "architecture"
author: ""
date: "2026-05-26"
category: "01-Project"
featured: false
image: ""
logo: ""
metrics: ""
status: "done"
---
# Architecture

The architecture is intentionally small: markdown is stored separately from the web runtime, and the viewer reads a generated JSON index.

## Layers

| Layer | Responsibility |
| --- | --- |
| Source | `.md` / `.mdx` files, assets, and folder structure |
| Index builder | Frontmatter, headings, wikilinks, backlinks, and aliases |
| Viewer runtime | Sidebar, routes, markdown rendering, roadmap route |
| Server shell | Static serving, auth, rebuild endpoint, config endpoint |

## Why this shape

- Markdown stays portable and editable in Obsidian.
- The viewer can be deployed as ordinary static files.
- The Node server is only needed for auth, `/__config`, or `/__rebuild`.
- The index can be rebuilt manually, by cron, by webhook, or in CI.

## Framework defaults

The project starts with neutral placeholder defaults:

| Setting | Default value |
| --- | --- |
| Local docs source | `docs-sample` |
| GitHub owner | `your-org` |
| GitHub repo | `your-docs-repo` |
| GitHub branch | `main` |
| GitHub docs path | `docs` |
| Auth | disabled with `AUTH_ENABLED=false` |

These values make the viewer usable as a framework/starter without company-specific defaults. For a real project, replace `docs-viewer.config.json` and `.env`.

## Responsibility boundary

`viewer/app.js` should not read source markdown files directly. It works with the build output: `viewer/data/vault-index.json`.

`scripts/build_viewer_index.mjs` should not decide how the UI looks. Its job is to prepare data.

## When changing this page, check

- [[Project|Project]], if the project map changes.
- [[Project Index Build|Index build]], if indexed data changes.
- [[Deployment Static|Static deployment]], if the viewer stops being purely static.
