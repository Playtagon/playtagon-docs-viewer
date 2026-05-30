---
title: "Docs Viewer Overview"
description: "A compact sample vault for testing docs structure, wikilinks, roadmap fields, and deployment flows."
aliases:
  - "Overview"
tags:
  - "overview"
  - "sample"
author: ""
date: "2026-05-26"
category: "00-Overview"
featured: true
image: ""
logo: ""
metrics: ""
status: "done"
---
# Docs Viewer Overview

`docs-sample` is a small documentation vault that shows how to organize a project with folders, index pages, feature pages, frontmatter, and Obsidian-style wikilinks.

Use it as a safe default source for trying the viewer before pointing the project at a real docs vault.

## Quick map

| Section | Purpose |
| --- | --- |
| [[Project\|Project]] | How the viewer works: source, index, runtime, and UI |
| [[Deployment\|Deployment]] | How to deploy the viewer |
| [[Operations\|Operations]] | How to update docs and handle common issues |
| [[Roadmap Sample\|Roadmap Sample]] | Dated sample items for the `#/roadmap` route |
| [[Project Obsidian PlayMap\|Obsidian Play Map]] | Local Obsidian companion plugin for editing roadmap data |

## Core idea

The viewer does not replace Obsidian. Your vault remains the authoring source of truth, while the web viewer becomes a read-only runtime:

1. Markdown files live in a vault.
2. `npm run build:index` generates `viewer/data/vault-index.json`.
3. `viewer/` is served as static files or through the optional Node server.

## Related pages

- [[Project Architecture|Architecture]] - project layers and file responsibilities.
- [[Deployment Static|Static deployment]] - the simplest public deployment path.
- [[Deployment Node|Node deployment]] - deployment with auth and server endpoints.
- [[Operations Update Docs|Update docs]] - how to refresh the index after markdown changes.
- [[Roadmap Sample|Roadmap Sample]] - sample roadmap items spanning May-December 2026.
- [[Project Obsidian PlayMap|Obsidian Play Map]] - how local Obsidian editing connects to the web viewer.

## When changing this page, check

- [[Project|Project]], if the architecture summary changes.
- [[Deployment|Deployment]], if the run/deploy model changes.
- [[Operations|Operations]], if the docs update process changes.
- [[Roadmap Sample|Roadmap Sample]], if the demo roadmap changes.
