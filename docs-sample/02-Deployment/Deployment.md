---
title: "Deployment"
description: "Deployment options for Docs Viewer."
aliases:
  - "Deployment"
tags:
  - "deployment"
  - "server"
author: ""
date: "2026-05-26"
category: "02-Deployment"
featured: true
image: ""
logo: ""
metrics: ""
status: "done"
---
# Deployment

There are two main deployment modes:

1. Static deployment - serve the `viewer/` folder through nginx, Vercel, Netlify, or any static host.
2. Node deployment - run `npm run dev` behind a reverse proxy.

## How to choose

| Option | Use when |
| --- | --- |
| [[Deployment Static\|Static deployment]] | Docs are public, or access control is handled outside this app |
| [[Deployment Node\|Node deployment]] | You need OAuth, `/__config`, `/__rebuild`, or private docs |

## Minimal production flow

```bash
npm run build:index
rsync -av --delete viewer/ user@server:/var/www/docs-viewer/
```

If you need a protected viewer, deploy the full project and run the Node service. See [[Deployment Node|Node deployment]].

## Sections

- [[Deployment Static|Static deployment]] - static hosting for `viewer/`.
- [[Deployment Node|Node deployment]] - Node server behind nginx.
- [[Deployment Auth|Auth deployment]] - environment variables and OAuth callbacks.

## When changing this page, check

- [[Project Runtime|Runtime]], if server behavior changes.
- [[Operations Update Docs|Update docs]], if publishing changes.
- [[Operations Troubleshooting|Troubleshooting]], if common symptoms change.
