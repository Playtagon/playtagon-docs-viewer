---
title: "Theme Operations"
description: "How to add, preview, switch, rebuild, and troubleshoot Docs Viewer themes."
aliases:
  - "Theme operations"
  - "Switch themes"
tags:
  - "operations"
  - "themes"
author: ""
date: "2026-06-06"
category: "03-Operations"
featured: false
image: ""
logo: ""
metrics: ""
status: "done"
---
# Theme Operations

Use this workflow when adding a new theme or switching the active theme for a deployment.

## Add a theme

Create a JSON file in the configured theme directory:

```text
themes/my-theme.json
```

Use the theme schema:

```json
{
  "schema": "docs-viewer-theme/v1",
  "id": "my-theme",
  "name": "My Theme",
  "mode": "light",
  "colors": {
    "background": "#f7f7f4",
    "panel": "#ffffff",
    "text": "#202522",
    "accent": "#19736c"
  }
}
```

Small theme files are valid. Missing tokens inherit from `default`.

## Switch active theme

Set the active theme in `docs-viewer.config.json`:

```json
{
  "theme": {
    "active": "my-theme",
    "directory": "themes"
  }
}
```

For environment-driven builds, set:

```env
DOCS_VIEWER_THEME_ACTIVE=my-theme
DOCS_VIEWER_THEME_DIRECTORY=themes
```

`DOCS_VIEWER_THEME_JSON` can provide a full inline theme and takes priority over `DOCS_VIEWER_THEME_ACTIVE`.

## Preview a theme

Run the viewer locally:

```bash
npm run build:index
npm run dev
```

Then use the topbar selector or open:

```text
http://127.0.0.1:8787/?theme=my-theme
```

Preview changes only the current browser. It does not change the configured active theme until config or env is updated and the index is rebuilt.

## Rebuild and publish

Static deployment:

```bash
npm run build:index
rsync -av --delete viewer/ user@server:/var/www/docs-viewer/
```

Node deployment:

```bash
cd /opt/docs-viewer
npm run build:index
sudo systemctl restart docs-viewer
```

If Settings is enabled for admins, choose a theme, save config, and run the rebuild from the viewer.

Vercel auth deployment:

1. Set `DOCS_VIEWER_THEME_ACTIVE` and `DOCS_VIEWER_THEME_DIRECTORY` in Vercel environment variables.
2. Make sure the `themes/` directory is included in the project.
3. Redeploy so `npm run build:index` writes the active theme into `viewer/data/vault-index.json`.

## Check contrast

Before publishing a theme, check:

- body text against background and panel;
- muted text against background and panel;
- links against background;
- code block text against `content.codeBlockBg`;
- active navigation text against `navigation.itemActiveBg`;
- auth login button text against `authLogin.buttonBg`;
- status colors where they appear as labels or badges.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Theme did not change | Confirm `theme.active` or `DOCS_VIEWER_THEME_ACTIVE`, then run `npm run build:index` |
| Theme preview works but production did not change | Publish the rebuilt `viewer/` folder or redeploy |
| Custom theme is ignored | Confirm the JSON file has a matching `id` and valid JSON syntax |
| Code blocks are hard to read | Adjust `content.codeBlockBg`, `content.codeBlockLine`, and `content.codeBlockText` |
| Active page is hard to see | Adjust `navigation.itemActiveBg`, `navigation.itemActiveText`, and `navigation.itemActiveMarker` |
| Auth login looks off | Adjust `authLogin` tokens and rebuild |

## When changing this page, check

- [[Project Themes|Themes]], if the theme model or token groups change.
- [[Operations Update Docs|Update docs]], if rebuild or publishing commands change.
- [[Deployment Static|Static deployment]], if static publishing changes.
- [[Deployment Node|Node deployment]], if server rebuild behavior changes.
- [[Deployment Auth|Auth deployment]], if Vercel auth deployment needs new theme env.
