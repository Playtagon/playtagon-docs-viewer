---
title: "Themes"
description: "How Docs Viewer themes are stored, selected, previewed, and applied."
aliases:
  - "Themes"
  - "Theme system"
tags:
  - "project"
  - "themes"
author: ""
date: "2026-06-06"
category: "01-Project"
featured: false
image: ""
logo: ""
metrics: ""
status: "done"
---
# Themes

Themes let one Docs Viewer codebase take on different product looks without changing markdown content or viewer code.

## Core idea

Theme JSON files live in the viewer project root:

```text
themes/
```

The active theme is selected in `docs-viewer.config.json`:

```json
{
  "theme": {
    "active": "playtagon-light",
    "directory": "themes"
  }
}
```

When `npm run build:index` runs, the build script reads the configured theme directory, resolves the active theme, and writes theme data into `viewer/data/vault-index.json`.

## Theme files

Each theme is an LLM-friendly JSON document:

```json
{
  "schema": "docs-viewer-theme/v1",
  "id": "custom",
  "name": "Custom",
  "mode": "light",
  "colors": {
    "background": "#f7f7f4",
    "panel": "#ffffff",
    "text": "#202522",
    "accent": "#19736c"
  }
}
```

Unknown fields are ignored. Missing fields inherit from the built-in `default` theme, so generated themes can start small and become more detailed over time.

## Theme selection

Theme selection is build-oriented:

1. `theme.active` names the preferred theme.
2. `theme.directory` points to the folder where JSON theme files are stored.
3. `DOCS_VIEWER_THEME_ACTIVE`, `DOCS_VIEWER_THEME_DIRECTORY`, or `DOCS_VIEWER_THEME_JSON` can override config during a build.
4. The active theme is written into `viewer/data/vault-index.json`.

If no theme is configured, the viewer uses the built-in `default` theme. If the configured theme is missing or invalid, the viewer falls back to `default` instead of failing the deployment.

## Token groups

Theme v1 uses semantic groups instead of CSS selectors:

| Group | Controls |
| --- | --- |
| `colors` | Viewer shell, panels, primary text, lines, and accent colors |
| `semantic` | Shared UI states such as warning, success, selection, shadows, and roadmap surfaces |
| `content` | Rendered markdown text, headings, links, quotes, code, tables, cards, and backlinks |
| `navigation` | Sidebar tree item text, hover, active state, marker, and branch lines |
| `authLogin` | Server-rendered sign-in page used by Node and Vercel auth deployments |
| `authStatus` | Signed-in user strip in the sidebar |
| `status` | Roadmap and status colors |

This split keeps content styling separate from application chrome. For example, a code block background should use `content.codeBlockBg`, not a generic panel color.

## Token reference

Top-level fields:

| Token | Purpose |
| --- | --- |
| `schema` | Theme schema id, currently `docs-viewer-theme/v1` |
| `id` | Stable theme id used by config, env, and preview URLs |
| `name` | Human-readable theme name shown in theme selectors |
| `mode` | `light` or `dark`; controls browser color-scheme behavior |
| `radius` | Default UI border radius |

`colors` tokens:

| Token | Purpose |
| --- | --- |
| `colors.background` | Main page background |
| `colors.panel` | Primary panels and sidebar surfaces |
| `colors.panelSubtle` | Secondary controls and subtle surfaces |
| `colors.text` | Primary UI text |
| `colors.muted` | Secondary UI text |
| `colors.line` | Standard borders and dividers |
| `colors.accent` | Primary action and link accent |
| `colors.accentStrong` | Hover or stronger accent state |
| `colors.onAccent` | Text placed on `colors.accent` |

`semantic` tokens:

| Token | Purpose |
| --- | --- |
| `semantic.separatorMuted` | Low-emphasis separators |
| `semantic.warningBg` | Warning surface background |
| `semantic.warningLine` | Warning border |
| `semantic.warningText` | Warning text |
| `semantic.successBg` | Success surface background |
| `semantic.successLine` | Success border |
| `semantic.successText` | Success text |
| `semantic.selectionBg` | Selected or active UI background |
| `semantic.roadmapGroupBg` | Roadmap group surface |
| `semantic.controlHoverBg` | Hover background for controls |
| `semantic.groupHoverBg` | Hover background for grouped rows/items |
| `semantic.mobileChromeBg` | Mobile sticky chrome background, usually with alpha |
| `semantic.shadow` | Standard elevation shadow |
| `semantic.popoverShadow` | Popover and floating-menu shadow |

`content` tokens:

| Token | Purpose |
| --- | --- |
| `content.text` | Rendered markdown body text |
| `content.muted` | Rendered markdown secondary text |
| `content.heading` | Markdown headings |
| `content.link` | Markdown links |
| `content.linkHover` | Markdown link hover |
| `content.rule` | Markdown horizontal rules and content dividers |
| `content.blockquoteLine` | Blockquote left border |
| `content.blockquoteText` | Blockquote text |
| `content.inlineCodeBg` | Inline code background |
| `content.codeBlockBg` | Fenced code block background |
| `content.codeBlockLine` | Fenced code block border |
| `content.codeBlockText` | Fenced code block text |
| `content.tableLine` | Markdown table borders |
| `content.tableHeaderBg` | Markdown table header background |
| `content.tableHeaderText` | Markdown table header text |
| `content.imageCaptionText` | Image caption text |
| `content.cardBg` | Document card background |
| `content.cardLine` | Document card border |
| `content.cardHoverLine` | Document card hover border |
| `content.cardTitleText` | Document card title text |
| `content.cardBodyText` | Document card body text |
| `content.backlinkBg` | Backlink chip/card background |
| `content.backlinkLine` | Backlink chip/card border |
| `content.backlinkHoverBg` | Backlink hover background |
| `content.backlinkHoverLine` | Backlink hover border |

`navigation` tokens:

| Token | Purpose |
| --- | --- |
| `navigation.itemText` | Sidebar item text |
| `navigation.itemMuted` | Sidebar secondary item text |
| `navigation.itemHoverBg` | Sidebar item hover background |
| `navigation.itemHoverText` | Sidebar item hover text |
| `navigation.itemActiveBg` | Active sidebar item background |
| `navigation.itemActiveText` | Active sidebar item text |
| `navigation.itemActiveMarker` | Active sidebar item marker |
| `navigation.branchLine` | Sidebar tree branch line |

`authLogin` tokens:

| Token | Purpose |
| --- | --- |
| `authLogin.background` | Server-rendered login page background |
| `authLogin.panelBg` | Login panel background |
| `authLogin.panelLine` | Login panel border |
| `authLogin.titleText` | Login title text |
| `authLogin.bodyText` | Login explanatory text |
| `authLogin.buttonBg` | Login provider button background |
| `authLogin.buttonText` | Login provider button text |
| `authLogin.buttonHoverBg` | Login provider button hover background |
| `authLogin.messageBg` | Login error/message background |
| `authLogin.messageLine` | Login error/message border |
| `authLogin.messageText` | Login error/message text |

`authStatus` tokens:

| Token | Purpose |
| --- | --- |
| `authStatus.line` | Signed-in status strip divider |
| `authStatus.emailText` | Signed-in email text |
| `authStatus.providerText` | Signed-in provider/admin text |
| `authStatus.signOutBg` | Sign-out link background |
| `authStatus.signOutText` | Sign-out link text |
| `authStatus.signOutHoverBg` | Sign-out link hover background |

`status` tokens:

| Token | Purpose |
| --- | --- |
| `status.backlog` | Backlog status color |
| `status.todo` | Todo status color |
| `status.planned` | Planned status color |
| `status.active` | Active/in-progress status color |
| `status.blocked` | Blocked status color |
| `status.done` | Done status color |

## Preview

The built index includes the active theme and a catalog of available themes. That lets the browser preview bundled themes without another rebuild.

Use the topbar theme selector or add a query parameter:

```text
http://127.0.0.1:8787/?theme=dracula
```

Preview is local to the current browser. To make a theme active for everyone, update config or env, then rebuild and publish.

## Auth surfaces

Most theme tokens are applied by `viewer/app.js` after it loads `vault-index.json`.

Auth has one extra surface: `/__auth/login` is rendered by the server before the browser app loads. The server reads the active built theme from `viewer/data/vault-index.json` and applies the `authLogin` tokens directly in the login page.

## When changing this page, check

- [[Project Index Build|Index build]], if theme data in `vault-index.json` changes.
- [[Project Runtime|Runtime]], if browser preview or CSS variable application changes.
- [[Deployment|Deployment]], if build-time theme selection changes.
- [[Operations Themes|Theme operations]], if the practical switching workflow changes.
