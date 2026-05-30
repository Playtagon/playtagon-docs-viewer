---
title: "Runtime"
description: "How the browser runtime and optional Node server work."
aliases:
  - "Runtime"
  - "Web runtime"
tags:
  - "project"
  - "runtime"
author: ""
date: "2026-05-26"
category: "01-Project"
featured: false
image: ""
logo: ""
metrics: ""
status: "done"
---
# Runtime

The runtime has two parts: the browser UI in `viewer/` and the optional Node server in `scripts/dev_server.mjs`.

## Browser UI

`viewer/app.js` loads `viewer/data/vault-index.json` and renders:

- sidebar from the folder tree;
- hash routes such as `#/overview`;
- markdown pages;
- wikilinks;
- backlinks;
- page table of contents from `##` through `####` headings;
- roadmap route `#/roadmap`.

The right-side `On this page` navigation is runtime UI, not authored content. It highlights the active heading while scrolling and uses a sticky topbar-aware offset for heading links.

`Linked mentions` are also runtime UI. The index builder resolves wikilinks and writes backlinks into `vault-index.json`; the browser renders those backlinks as linked document chips.

## Node server

The command:

```bash
npm run dev
```

starts the server on `PORT` or `8787` by default.

The server can:

- serve files from `viewer/`;
- protect the viewer with OAuth when `AUTH_ENABLED=true`;
- expose `/__auth/login`, `/__auth/me`, `/__auth/logout`, and OAuth callbacks;
- expose `/__config` to admins only;
- accept `/__config` updates from admins only;
- run `/__rebuild` for admins only.

## Auth and admin access

The auth wall runs on the server. Access is granted only after an OAuth/OIDC callback, verified email check, and signed HttpOnly session cookie creation.

Permission split:

| Permission | Env |
|------|-----|
| Read docs | `AUTH_ALLOWED_EMAILS`, `AUTH_ALLOWED_DOMAINS` |
| Open Settings and trigger rebuilds | `AUTH_ADMIN_EMAILS` |

When `AUTH_ENABLED=true`, opening a page without a session redirects to `/__auth/login`. Data/API requests without a session receive JSON `401`, so the browser runtime does not try to parse an HTML login page as `vault-index.json`.

The Refresh button is visible to all users. For admins, it calls `/__rebuild` and reloads the index. For non-admin readers, it only reloads the latest published `viewer/data/vault-index.json`.

## When Node is not needed

If the docs are public and do not need server endpoints, deploy only the `viewer/` folder. See [[Deployment-Static|Static deployment]].

## When changing this page, check

- [[Deployment-Node|Node deployment]], if server startup changes.
- [[Deployment-Auth|Auth deployment]], if auth changes.
- [[Project-Architecture|Architecture]], if browser/server boundaries change.
