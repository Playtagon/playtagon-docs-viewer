---
title: "Auth Deployment"
description: "Configure AUTH_ENABLED, OAuth providers, and access rules for private docs."
aliases:
  - "Auth deployment"
  - "OAuth deployment"
tags:
  - "deployment"
  - "auth"
author: ""
date: "2026-05-26"
category: "02-Deployment"
featured: false
image: ""
logo: ""
metrics: ""
status: "done"
---
# Auth Deployment

Auth works only in [[Deployment-Node|Node deployment]], because static hosting cannot run the server-side OAuth flow.

## Minimal `.env`

```env
AUTH_ENABLED=true
AUTH_BASE_URL=https://docs.example.com
AUTH_SESSION_SECRET=replace-with-long-random-string-at-least-32-chars
AUTH_ALLOWED_DOMAINS=example.com
AUTH_ADMIN_EMAILS=alice@example.com
AUTH_PROVIDERS=google

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

## Callback URLs

For Google:

```text
https://docs.example.com/__auth/callback/google
```

For GitHub:

```text
https://docs.example.com/__auth/callback/github
```

For generic OIDC:

```text
https://docs.example.com/__auth/callback/oidc
```

## Access policy

A user is allowed when their verified email matches one of these rules:

- `AUTH_ALLOWED_EMAILS`;
- `AUTH_ALLOWED_DOMAINS`.

Admins are listed in `AUTH_ADMIN_EMAILS`.

## Important details

- `AUTH_SESSION_SECRET` must be long and random.
- `AUTH_BASE_URL` must match the public HTTPS domain.
- Nginx must forward `Host` and `X-Forwarded-Proto`.

## When changing this page, check

- [[Deployment-Node|Node deployment]], if proxy setup changes.
- [[Project-Runtime|Runtime]], if auth endpoints change.
- [[Operations-Troubleshooting|Troubleshooting]], if new auth errors appear.
