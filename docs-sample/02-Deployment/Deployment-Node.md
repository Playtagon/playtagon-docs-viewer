---
title: "Node Deployment"
description: "Deploy Docs Viewer as a Node service behind nginx."
aliases:
  - "Node deployment"
tags:
  - "deployment"
  - "node"
author: ""
date: "2026-05-26"
category: "02-Deployment"
featured: false
image: ""
logo: ""
metrics: ""
status: "done"
---
# Node Deployment

Node deployment is needed when the viewer should manage auth, config, or rebuilds itself.

## Upload the project

```bash
mkdir -p /opt/docs-viewer
rsync -av --delete \
  package.json scripts viewer docs-sample docs-viewer.config.json .env.example \
  user@server:/opt/docs-viewer/
```

## Prepare the server

```bash
cd /opt/docs-viewer
cp .env.example .env
npm run build:index
PORT=8787 npm run dev
```

## Systemd service

```ini
[Unit]
Description=Docs Viewer
After=network.target

[Service]
WorkingDirectory=/opt/docs-viewer
Environment=PORT=8787
ExecStart=/usr/bin/npm run dev
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

## Nginx reverse proxy

```nginx
server {
  server_name docs.example.com;

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

## When to choose this option

- You need built-in OAuth.
- You need to rebuild the index through `/__rebuild`.
- You need to edit config through `/__config`.
- Docs should not be fully public.

## When changing this page, check

- [[Deployment-Auth|Auth deployment]], if environment variables change.
- [[Project-Runtime|Runtime]], if server behavior changes.
- [[Operations-Troubleshooting|Troubleshooting]], if diagnostic commands change.
