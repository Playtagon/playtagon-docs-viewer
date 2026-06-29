---
title: "Project"
description: "Hoe de docs viewer werkt."
aliases:
  - "Project"
tags:
  - "project"
  - "architecture"
author: ""
date: "2026-05-26"
category: "01-Project"
featured: true
image: ""
logo: ""
metrics: ""
status: "done"
translationKey: "01-Project/Project"
---
# Project

Docs Viewer is een lichte webclient voor Obsidian-style documentatie. Hij leest een markdown-vault, bouwt een JSON-index en rendert docs in de browser zonder zwaar frontend framework.

## Projectonderdelen

| Onderdeel | Pad | Rol |
| --- | --- | --- |
| Source vault | `docs-sample/` of je eigen vault | Markdown files, frontmatter, wikilinks en assets |
| Build script | `scripts/build_viewer_index.mjs` | Bouwt pages, links, aliases, backlinks en folder tree |
| Runtime server | `scripts/dev_server.mjs` | Serveert de viewer, auth en server endpoints |
| Static viewer | `viewer/` | HTML, CSS, JS en `data/vault-index.json` |
| Themes | `themes/` | JSON theme files voor build en runtime |
| Viewer plugins | `plugins/` | Source files voor viewer-extensies zoals Roadmap |
| Obsidian plugins | `plugins-obsidian/` | Catalogus voor lokale Obsidian companion plugins |
| Play Map | `plugins-obsidian/playmap/` | Obsidian roadmap plugin folder die gebruikers naar een vault kunnen kopieren |
| Config | `docs-viewer.config.json` | Kiest source en ignored folders |

## Hoofdflow

```text
markdown vault
  -> scripts/build_viewer_index.mjs
  -> viewer/data/vault-index.json
  -> viewer/app.js
  -> browser UI
```

## Secties

- [[Project Architecture|Architecture]] - lagen en verantwoordelijkheden.
- [[Project Index Build|Index build]] - hoe markdown JSON wordt.
- [[Project Runtime|Runtime]] - wat de browser UI en Node server doen.
- [[Project Multilingual Docs NL|Multilingual docs NL]] - optionele language folders, translation pairs en language switching.
- [[Project Themes|Themes]] - theme files, token groups, preview en fallback behavior.
- [[Project Obsidian PlayMap|Obsidian Play Map]] - hoe de lokale Obsidian plugin in de workflow past.

## When changing this page, check

- [[Project Architecture|Architecture]], if layer boundaries change.
- [[Project Index Build|Index build]], if the `vault-index.json` format changes.
- [[Project Runtime|Runtime]], if server or browser behavior changes.
- [[Project Multilingual Docs NL|Multilingual docs NL]], if language folder behavior changes.
- [[Project Themes|Themes]], if theme ownership or folder structure changes.
- [[Project Obsidian PlayMap|Obsidian Play Map]], if plugin organization changes.
