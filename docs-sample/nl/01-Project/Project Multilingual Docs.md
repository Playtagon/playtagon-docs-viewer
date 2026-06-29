---
title: "Meertalige Docs"
description: "Hoe optionele meertalige documentatie werkt in Docs Viewer."
aliases:
  - "Multilingual docs"
  - "i18n"
tags:
  - "project"
  - "i18n"
author: ""
date: "2026-06-29"
category: "01-Project"
featured: false
image: ""
logo: ""
metrics: ""
status: "done"
---
# Meertalige Docs

Docs Viewer kan draaien als single-language viewer of als meertalige viewer.

De feature is optioneel. Wanneer `i18n.enabled` `false` is, behoudt de viewer de normale page tree, aliases, search, wikilinks en routes.

## Configuratie

Zet meertalige docs aan in `docs-viewer.config.json`:

```json
{
  "i18n": {
    "enabled": true,
    "defaultLanguage": "en",
    "languages": [
      { "code": "en", "label": "English", "basePath": "/" },
      { "code": "nl", "label": "Nederlands", "basePath": "/nl" }
    ]
  }
}
```

Hosted builds kunnen environment variables gebruiken:

```env
DOCS_VIEWER_I18N_ENABLED=true
DOCS_VIEWER_I18N_DEFAULT_LANGUAGE=en
DOCS_VIEWER_I18N_LANGUAGES=en:English:/,nl:Nederlands:/nl
```

## Foldermodel

Er zijn twee ondersteunde layouts.

De migration-friendly layout houdt de default language aan de source root en zet extra talen in language folders:

```text
docs/
├── Project/Overview.md
└── nl/
    └── Project/Overview.md
```

In deze layout wordt `Project/Overview.md` behandeld als `defaultLanguage`, en `nl/Project/Overview.md` als de Nederlandse vertaling.

De strict language-folder layout zet iedere taal in een top-level language folder:

```text
docs/
├── en/
│   └── Project/Overview.md
└── nl/
    └── Project/Overview.md
```

Het pad na de language folder wordt de translation key. Root default-language pages gebruiken hun root-relative path als translation key. In beide voorbeelden delen de vertaalde pagina's `Project/Overview`.

Als vertaalde bestanden geen mirrored paths kunnen gebruiken, zet dan dezelfde `translationKey` in frontmatter op elke vertaalde pagina.

## Demo source

Deze repository bevat een kleine twee-talige demo direct in `docs-sample/`:

```text
docs-sample/
├── 00-Overview/
│   └── Overview.md
├── 01-Project/
│   └── Project Multilingual Docs.md
└── nl/
    ├── 00-Overview/
    │   └── Overview.md
    └── 01-Project/
        └── Project Multilingual Docs.md
```

Run hem lokaal met:

```bash
DOCS_VIEWER_I18N_ENABLED=true \
DOCS_VIEWER_I18N_DEFAULT_LANGUAGE=en \
DOCS_VIEWER_I18N_LANGUAGES='en:English:/,nl:Nederlands:/nl' \
node scripts/build_viewer_index.mjs docs-sample viewer/data/vault-index.json

PORT=8790 npm run dev
```

Open daarna `/overview/overview` of `/nl/overview/overview` en gebruik de language selector.

## Build output

Wanneer i18n aan staat, schrijft `npm run build:index`:

- `page.language`;
- `page.pathWithoutLanguage`;
- `page.translationKey`;
- `page.translations`;
- `aliasesByLanguage`;
- `treesByLanguage`;
- `i18n` config metadata.

Wikilinks worden eerst in de huidige taal opgelost en vallen daarna terug op global aliases.

## Runtime behavior

De browser runtime gebruikt de huidige page language om:

- de sidebar te renderen zonder language folders als gewone nav sections te tonen;
- wikilinks eerst in de huidige taal op te lossen;
- een compacte language selector te tonen wanneer meerdere talen geconfigureerd zijn;
- naar de vertaalde pagina te wisselen wanneer die translation bestaat.

Pagina's zonder vertaling houden unavailable language options disabled.

## When changing this page, check

- [[Project Index Build|Index build]], if indexed i18n fields change.
- [[Project Runtime|Runtime]], if language switching or language-specific navigation changes.
- [[Operations Update Docs|Update docs]], if the multilingual publishing flow changes.
