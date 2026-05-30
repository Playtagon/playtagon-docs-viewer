---
title: "Troubleshooting"
description: "Common Docs Viewer issues and quick checks."
aliases:
  - "Troubleshooting"
tags:
  - "operations"
  - "debug"
author: ""
date: "2026-05-26"
category: "03-Operations"
featured: false
image: ""
logo: ""
metrics: ""
status: "done"
---
# Troubleshooting

## Viewer shows old pages

Most likely, `viewer/data/vault-index.json` was not updated.

```bash
npm run build:index
```

For static deployment, upload `viewer/` again after rebuilding.

## A page is not found through a wikilink

Check:

- whether a markdown file with that basename exists;
- whether the expected alias exists in frontmatter;
- whether a table is broken by an unescaped `|`.

Inside tables, use:

```md
[[Project\|Project]]
```

## Auth rejects a user

Check:

- `AUTH_ENABLED=true`;
- `AUTH_BASE_URL` matches the public domain;
- the user email is verified by the OAuth provider;
- the domain is listed in `AUTH_ALLOWED_DOMAINS` or the email is listed in `AUTH_ALLOWED_EMAILS`;
- the callback URL is registered in the OAuth app.

## Nginx returns 502

Check that the Node service is running:

```bash
sudo systemctl status docs-viewer
```

And that the nginx proxy points to the right port:

```text
proxy_pass http://127.0.0.1:8787;
```

## When changing this page, check

- [[Deployment Node|Node deployment]], if systemd or proxy setup changes.
- [[Deployment Auth|Auth deployment]], if auth behavior changes.
- [[Operations Update Docs|Update docs]], if the rebuild flow changes.
