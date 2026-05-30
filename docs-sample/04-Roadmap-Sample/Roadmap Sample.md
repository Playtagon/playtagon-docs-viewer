---
title: "Roadmap Sample"
description: "A small set of dated sample items used to demonstrate the roadmap timeline and board."
aliases:
  - "Roadmap Sample"
tags:
  - "roadmap"
  - "sample"
author: ""
date: "2026-05-29"
category: "04-Roadmap-Sample"
featured: true
image: ""
logo: ""
metrics: ""
status: "planned"
---
# Roadmap Sample

This section exists only to make the built-in `#/roadmap` route useful in the sample project.

Each child page has roadmap frontmatter with dates between May and December 2026. The roadmap plugin reads those fields and turns the pages into timeline bars and board cards.

The sample is intentionally nested so the roadmap can demonstrate folder groups:

```text
04-Roadmap-Sample/
├── 01-Foundation/
├── 02-Experience/
├── 03-Launch/
└── 04-Future/
```

## Sample items

| Item | Status | Window |
| --- | --- | --- |
| [[Roadmap Sample Discovery\|Discovery]] | Done | May 2026 |
| [[Roadmap Sample Indexing\|Indexing]] | In progress | June-July 2026 |
| [[Roadmap Sample Viewer UX\|Viewer UX]] | Planned | July-August 2026 |
| [[Roadmap Sample Auth Admin\|Auth and admin]] | Planned | August-September 2026 |
| [[Roadmap Sample Deployment\|Deployment]] | Todo | October 2026 |
| [[Roadmap Sample Plugin Runtime\|Plugin runtime]] | Backlog | November-December 2026 |

## Roadmap fields

Roadmap items are ordinary docs pages with a few extra frontmatter fields:

```yaml
status: planned
roadmap_start: 2026-07-01
roadmap_end: 2026-08-15
```

Pages can also define `scopes` when one page should produce multiple roadmap bars.

The sample config uses:

```json
{
  "roadmap": {
    "includedFolders": ["04-Roadmap-Sample"],
    "excludedFolders": [],
    "hideUndated": false
  }
}
```

## When changing this page, check

- [[Project Runtime|Runtime]], if roadmap rendering changes.
- [[Operations Update Docs|Update docs]], if sample data needs to be rebuilt.
- `#/roadmap`, to confirm the sample timeline still spans May-December 2026.
