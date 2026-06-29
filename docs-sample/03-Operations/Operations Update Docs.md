---
title: "Update Docs"
description: "How to update markdown documentation and publish a new viewer index."
aliases:
  - "Update docs"
tags:
  - "operations"
  - "update"
author: ""
date: "2026-05-26"
category: "03-Operations"
featured: false
image: ""
logo: ""
metrics: ""
status: "done"
---
# Update Docs

The update flow depends on the deployment mode.

## Static deployment

```bash
npm run build:index
rsync -av --delete viewer/ user@server:/var/www/docs-viewer/
```

The same rebuild is required after switching the active theme, because theme data is written into `viewer/data/vault-index.json`.

## Node deployment

Update the source vault on the server and rebuild the index:

```bash
cd /opt/docs-viewer
npm run build:index
sudo systemctl restart docs-viewer
```

If `/__rebuild` is enabled, the server runtime can rebuild the index.

If the server should switch themes, keep the root `themes/` directory available on the server. See [[Operations Themes|Theme operations]].

For multilingual docs, update mirrored files under each language folder and rebuild so `page.translations` and language-specific navigation stay current.

## Checklist

- The start page opens.
- Wikilinks work.
- Sidebar shows new pages.
- Backlinks appear where incoming links are expected.
- The active theme is visible after rebuild.
- Language switching works if multilingual docs are enabled.
- `#/roadmap` opens if roadmap fields are used.

## When changing this page, check

- [[Deployment Static|Static deployment]], if static upload changes.
- [[Deployment Node|Node deployment]], if the server flow changes.
- [[Project Index Build|Index build]], if the build command changes.
- [[Project Multilingual Docs|Multilingual docs]], if language folder workflow changes.
- [[Operations Themes|Theme operations]], if theme rebuild steps change.
