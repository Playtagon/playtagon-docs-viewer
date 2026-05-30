---
title: "Static Deployment"
description: "The simplest way to deploy Docs Viewer as a static site."
aliases:
  - "Static deployment"
tags:
  - "deployment"
  - "static"
author: ""
date: "2026-05-26"
category: "02-Deployment"
featured: false
image: ""
logo: ""
metrics: ""
status: "done"
---
# Static Deployment

Static deployment is the right fit when the viewer is public or protected by another infrastructure layer.

## Build

```bash
npm run build:index
```

This updates:

```text
viewer/data/vault-index.json
```

## Upload to a server

```bash
rsync -av --delete viewer/ user@server:/var/www/docs-viewer/
```

## Nginx

```nginx
server {
  server_name docs.example.com;

  root /var/www/docs-viewer;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

## SSL

```bash
sudo certbot --nginx -d docs.example.com
```

## Limitations

- No built-in OAuth.
- No `/__rebuild`.
- No `/__config`.
- To update docs, rebuild the index and upload `viewer/` again.

## When changing this page, check

- [[Deployment|Deployment]], if the static vs Node tradeoff changes.
- [[Operations Update Docs|Update docs]], if publishing changes.
- [[Project Runtime|Runtime]], if the browser UI starts requiring a backend.
