---
title: "Docs Viewer Overzicht"
description: "Een compacte voorbeeld-vault voor docs-structuur, wikilinks, roadmap-velden en deployment flows."
aliases:
  - "Overzicht"
tags:
  - "overview"
  - "sample"
author: ""
date: "2026-05-26"
category: "00-Overview"
featured: true
image: ""
logo: ""
metrics: ""
status: "done"
translationKey: "00-Overview/Overview"
---
# Docs Viewer Overzicht

`docs-sample` is een kleine documentatie-vault die laat zien hoe je een project organiseert met mappen, indexpagina's, feature-pagina's, frontmatter en Obsidian-style wikilinks.

Gebruik deze vault als veilige standaardbron om de viewer te testen voordat je het project naar een echte docs-vault laat wijzen.

## Snelle kaart

| Sectie | Doel |
| --- | --- |
| [[Project NL\|Project NL]] | Hoe de viewer werkt: source, index, runtime en UI |
| [[Deployment\|Deployment]] | Hoe je de viewer deployt |
| [[Operations\|Operations]] | Hoe je docs bijwerkt, themes wisselt en veelvoorkomende problemen oplost |
| [[Roadmap Sample\|Roadmap Sample]] | Gedateerde voorbeelditems voor de `#/roadmap` route |
| [[Project Obsidian PlayMap\|Obsidian Play Map]] | Lokale Obsidian companion plugin voor roadmap-data |

## Kernidee

De viewer vervangt Obsidian niet. Je vault blijft de authoring source of truth, terwijl de web viewer een read-only runtime wordt:

1. Markdown-bestanden staan in een vault.
2. `npm run build:index` genereert `viewer/data/vault-index.json`.
3. `viewer/` wordt als static files of via de optionele Node server geserveerd.

## Gerelateerde pagina's

- [[Project Architecture|Architecture]] - projectlagen en file-verantwoordelijkheden.
- [[Project Multilingual Docs NL|Multilingual docs NL]] - optionele language folders en translation switching.
- [[Project Themes|Themes]] - theme files, token groups, preview en fallback behavior.
- [[Deployment Static|Static deployment]] - het eenvoudigste publieke deployment-pad.
- [[Deployment Node|Node deployment]] - deployment met auth en server endpoints.
- [[Operations Update Docs|Update docs]] - hoe je de index ververst na markdown-wijzigingen.
- [[Operations Themes|Theme operations]] - hoe je themes toevoegt, previewt, wisselt en publiceert.
- [[Roadmap Sample|Roadmap Sample]] - sample roadmap items van mei tot december 2026.
- [[Project Obsidian PlayMap|Obsidian Play Map]] - hoe lokale Obsidian editing aansluit op de web viewer.

## When changing this page, check

- [[Project NL|Project NL]], if the architecture summary changes.
- [[Deployment|Deployment]], if the run/deploy model changes.
- [[Operations|Operations]], if the docs update process changes.
- [[Project Multilingual Docs NL|Multilingual docs NL]], if language support changes.
- [[Project Themes|Themes]], if theme behavior changes.
- [[Roadmap Sample|Roadmap Sample]], if the demo roadmap changes.
