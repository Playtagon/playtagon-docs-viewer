---
title: "Multilingual Docs"
description: "How optional multilingual documentation works in Docs Viewer."
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
# Multilingual Docs

Docs Viewer can run as a single-language viewer or as a multilingual viewer.

The feature is optional. When `i18n.enabled` is `false`, the viewer keeps the ordinary page tree, aliases, search, wikilinks, and routes.

## Configuration

Enable multilingual docs in `docs-viewer.config.json`:

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

Hosted builds can use environment variables:

```env
DOCS_VIEWER_I18N_ENABLED=true
DOCS_VIEWER_I18N_DEFAULT_LANGUAGE=en
DOCS_VIEWER_I18N_LANGUAGES=en:English:/,nl:Nederlands:/nl
```

## Folder model

There are two supported layouts.

Migration-friendly layout keeps the default language at the source root and puts additional languages in language folders:

```text
docs/
├── Project/Overview.md
└── nl/
    └── Project/Overview.md
```

In this layout, `Project/Overview.md` is treated as `defaultLanguage`, and `nl/Project/Overview.md` is treated as the Dutch translation.

Strict language-folder layout puts every language under a language folder:

```text
docs/
├── en/
│   └── Project/Overview.md
└── nl/
    └── Project/Overview.md
```

The path after the language folder becomes the translation key. Root default-language pages use their root-relative path as the translation key. In both examples, the translated pages share `Project/Overview`.

If translated files cannot use mirrored paths, set the same `translationKey` in frontmatter on each translated page.

## Demo source

The repository includes a small two-language demo directly in `docs-sample/`:

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

Run it locally with:

```bash
DOCS_VIEWER_I18N_ENABLED=true \
DOCS_VIEWER_I18N_DEFAULT_LANGUAGE=en \
DOCS_VIEWER_I18N_LANGUAGES='en:English:/,nl:Nederlands:/nl' \
node scripts/build_viewer_index.mjs docs-sample viewer/data/vault-index.json

PORT=8790 npm run dev
```

Then open `/overview/overview` or `/nl/overview/overview` and use the language selector.

## Build output

When i18n is enabled, `npm run build:index` writes:

- `page.language`;
- `page.pathWithoutLanguage`;
- `page.translationKey`;
- `page.translations`;
- `aliasesByLanguage`;
- `treesByLanguage`;
- `i18n` config metadata.

Wikilinks resolve inside the current language first, then fall back to global aliases.

## Runtime behavior

The browser runtime uses the current page language to:

- render the sidebar without exposing language folders as ordinary nav sections;
- resolve wikilinks in the current language first;
- show a compact language selector when multiple configured languages exist;
- switch to the translated page when that translation exists.

Pages without a translation keep unavailable language options disabled.

## When changing this page, check

- [[Project Index Build|Index build]], if indexed i18n fields change.
- [[Project Runtime|Runtime]], if language switching or language-specific navigation changes.
- [[Operations Update Docs|Update docs]], if the multilingual publishing flow changes.
