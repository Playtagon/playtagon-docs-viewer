---
title: "Operations"
description: "Operational notes for updating docs, rebuilding the index, and checking common issues."
aliases:
  - "Operations"
tags:
  - "operations"
  - "docs"
author: ""
date: "2026-05-26"
category: "03-Operations"
featured: true
image: ""
logo: ""
metrics: ""
status: "done"
---
# Operations

This section describes day-to-day work with the viewer after deployment.

## Typical cycle

1. Edit markdown in the source vault.
2. Build the index.
3. Check the viewer locally.
4. Upload the update or trigger a rebuild.

## Sections

- [[Operations Update Docs|Update docs]] - how to update content.
- [[Operations Troubleshooting|Troubleshooting]] - what to check when something does not open.

## Commands

```bash
npm run build:index
npm run dev
```

## When changing this page, check

- [[Deployment|Deployment]], if the production flow changes.
- [[Project Index Build|Index build]], if index building changes.
- [[Operations Troubleshooting|Troubleshooting]], if symptoms or commands change.
