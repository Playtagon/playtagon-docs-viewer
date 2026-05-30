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

## Node deployment

Update the source vault on the server and rebuild the index:

```bash
cd /opt/docs-viewer
npm run build:index
sudo systemctl restart docs-viewer
```

If `/__rebuild` is enabled, the server runtime can rebuild the index.

## Checklist

- The start page opens.
- Wikilinks work.
- Sidebar shows new pages.
- Backlinks appear where incoming links are expected.
- `#/roadmap` opens if roadmap fields are used.

## When changing this page, check

- [[Deployment Static|Static deployment]], if static upload changes.
- [[Deployment Node|Node deployment]], if the server flow changes.
- [[Project Index Build|Index build]], if the build command changes.
