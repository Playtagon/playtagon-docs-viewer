# Docs Viewer

Docs Viewer is a lightweight, static-first web viewer for Obsidian-style markdown documentation.

It is designed for teams that want to keep writing in a normal markdown vault while publishing a clean, read-only web experience. The source of truth stays in markdown; the browser reads a generated JSON index.

## What It Does

- Reads a local markdown vault, such as `docs-sample/`.
- Parses YAML frontmatter, headings, aliases, Obsidian wikilinks, backlinks, and assets.
- Generates `viewer/data/vault-index.json`.
- Renders a browser UI with sidebar navigation, search, markdown pages, page table of contents, backlinks, and a roadmap route.
- Keeps route and heading-anchor navigation stable with sticky topbar-aware scroll offsets.
- Can be deployed as static files.
- Can optionally run behind a small Node server for OAuth, config editing, and rebuilds.

## Project Structure

```text
docs-viewer/
├── docs-sample/                  # Example markdown vault
├── plugins/
│   └── roadmap/                  # Viewer roadmap plugin source
├── plugins-obsidian/             # Obsidian companion plugins
│   └── playmap/                  # Play Map Obsidian plugin
├── scripts/
│   ├── build_viewer_index.mjs    # Markdown vault -> JSON index
│   ├── build_knowledge_base.py   # Markdown vault -> one LLM-ready context file
│   ├── dev_server.mjs            # Static server + optional auth/config/rebuild endpoints
│   └── load_env.mjs
├── viewer/
│   ├── app.js                    # Browser runtime
│   ├── index.html
│   ├── styles.css
│   ├── data/
│   │   └── vault-index.json
│   └── plugins/
│       └── roadmap/              # Browser-served plugin copy
├── docs-viewer.config.example.json
├── .env.example
└── package.json
```

## Quick Start

```bash
npm run build:index
npm run dev
```

Open:

```text
http://127.0.0.1:8787
```

By default, the example config points at `docs-sample/`.

## LLM Context File

Sometimes the fastest way to give an LLM project context is not to send it a folder tree one file at a time, but to hand it one Markdown file with the relevant documentation already stitched together. The knowledge-base builder exists for that workflow.

```bash
npm run build:kb
```

The command scans `docs-sample/` and writes `knowledge-base.md`. The output is meant as an LLM context packet, not as a perfect archive of the source files: it keeps file paths, source labels, a table of contents, and the document content, while compacting repeated blank lines and trailing whitespace so the result is easier to paste or upload as context.

You can point it at another vault:

```bash
python3 scripts/build_knowledge_base.py path/to/docs -o knowledge-base.md --title "Project Knowledge Base"
```

If you need the original spacing preserved, add `--verbatim`:

```bash
python3 scripts/build_knowledge_base.py docs-sample -o knowledge-base.md --verbatim
```

## Configuration

Create a local config from the example:

```bash
cp docs-viewer.config.example.json docs-viewer.config.json
```

The local config is ignored by git so projects can keep private paths or repository names out of public commits.

```json
{
  "app": {
    "title": "Docs Viewer"
  },
  "source": {
    "type": "local",
    "local": {
      "path": "docs-sample"
    },
    "github": {
      "owner": "your-org",
      "repo": "your-docs-repo",
      "branch": "main",
      "path": ""
    }
  },
  "roadmap": {
    "includedFolders": [
      "04-Roadmap-Sample"
    ],
    "excludedFolders": [],
    "hideUndated": false
  },
  "plugins": {
    "roadmap": {
      "enabled": true
    }
  }
}
```

`app.title` controls the viewer brand text and browser tab suffix.

`source.github.path` is optional. Leave it empty to index markdown from the repository root, or set it to a subfolder when docs live below the root.

`roadmap.includedFolders` is the explicit allowlist for pages shown at `#/roadmap`. Leave it empty to let the roadmap scan the full vault. `roadmap.excludedFolders` is applied after the allowlist, so it is useful for excluding archive or draft subfolders inside a broader included folder.

`plugins.<pluginId>.enabled` controls whether a viewer plugin is available at runtime. When `plugins.roadmap.enabled` is `false`, the Roadmap toolbar button is hidden and `/roadmap` redirects back to `/`.

Hosted deployments can override the local config with environment variables. This is useful when the open-source viewer should build from a private docs repository without committing `docs-viewer.config.json`:

```env
DOCS_VIEWER_APP_TITLE=Playtagon Docs
DOCS_VIEWER_SOURCE_TYPE=github
DOCS_VIEWER_GITHUB_OWNER=Playtagon
DOCS_VIEWER_GITHUB_REPO=playtagon-docs-internal
DOCS_VIEWER_GITHUB_BRANCH=main
DOCS_VIEWER_GITHUB_PATH=
DOCS_VIEWER_GITHUB_TOKEN=
DOCS_VIEWER_ROADMAP_INCLUDED_FOLDERS=__empty__
DOCS_VIEWER_ROADMAP_EXCLUDED_FOLDERS=__empty__
DOCS_VIEWER_ROADMAP_HIDE_UNDATED=false
DOCS_VIEWER_PLUGIN_ROADMAP_ENABLED=true
```

`DOCS_VIEWER_GITHUB_TOKEN` is only needed for private GitHub sources. Use `__empty__` when an environment-backed list should intentionally be empty, for example an empty roadmap include list that scans the full vault.

To customize the browser favicon, place `favicon.ico`, `favicon.png`, or `favicon.svg` anywhere in the indexed docs assets, for example `00 Assets/favicon.png`. The viewer will use it automatically after rebuilding the index.

## Writing Docs

Docs Viewer expects ordinary markdown with optional YAML frontmatter:

```md
---
title: "Project"
aliases:
  - "Project overview"
status: "planned"
roadmap_start: 2026-06-01
roadmap_end: 2026-06-14
---
# Project

Link to another page with [[Deployment|Deployment]].
```

Useful conventions:

- Put related pages in folders.
- Give folder index pages the same basename as the folder.
- Use `aliases` for human-readable links.
- Escape wikilink aliases inside markdown tables: `[[Page\|Alias]]`.
- Add an impact block at the end, for example `## When changing this page, check`.

The page table of contents is generated from `##` through `####` headings. `Linked mentions` are generated automatically from resolved wikilinks and rendered as document chips in the viewer; they are not authored as a manual markdown section.

## Deployment

Docs Viewer supports three deployment modes.

Static deployment serves the generated `viewer/` folder directly. Use it for public docs or when access is handled by hosting infrastructure:

```bash
npm run build:index
rsync -av --delete viewer/ user@server:/var/www/docs-viewer/
```

Node deployment runs the shared server handler as a long-running service. Use it on a VPS when you need built-in OAuth, `/__config`, or `/__rebuild`:

```bash
cp .env.example .env
npm run build:index
PORT=8787 npm run dev
```

Vercel auth deployment uses Vercel Functions with the same auth handler as Node mode. The included `vercel.json` builds the index, routes requests through `api/server.mjs`, and includes `viewer/**` in the function bundle. Configure the project environment with `AUTH_ENABLED=true`, provider credentials, and the `DOCS_VIEWER_*` source variables.

For a separate static-only Vercel project, override the project settings:

```text
Build Command: npm run build:index
Output Directory: viewer
```

## Auth

Server-side auth is disabled by default. To enable it in Node or Vercel auth deployment, configure `.env` or Vercel Environment Variables:

```env
AUTH_ENABLED=true
AUTH_BASE_URL=https://docs.example.com
AUTH_SESSION_SECRET=replace-with-at-least-32-random-characters
AUTH_ALLOWED_DOMAINS=example.com
AUTH_ADMIN_EMAILS=alice@example.com
AUTH_PROVIDERS=google
```

Supported providers are Google, GitHub, and generic OIDC.

## Roadmap Plugins

The repository includes two related roadmap integrations:

- `plugins/roadmap/` - the Docs Viewer roadmap plugin source.
- `plugins-obsidian/playmap/` - the Obsidian Play Map companion plugin.

The build step copies viewer plugins into `viewer/plugins/` so static hosting can serve them with the rest of the viewer.

Viewer plugins must be guarded by config. Add a default under `plugins.<pluginId>.enabled`, write that state into `viewer/data/vault-index.json`, hide plugin UI when disabled, and make the plugin route redirect to `/`. Vercel deployments should expose the same flag as `DOCS_VIEWER_PLUGIN_<PLUGIN_ID>_ENABLED`.

The roadmap is built from docs frontmatter:

```yaml
status: planned
roadmap_start: 2026-06-01
roadmap_end: 2026-06-14
```

The web viewer exposes it at:

```text
#/roadmap
```

The sample config points the roadmap at `docs-sample/04-Roadmap-Sample`, which contains nested groups and dated items from May to December 2026.

## Obsidian Play Map

Play Map is the local Obsidian side of the workflow. It lets authors view and manage the roadmap inside Obsidian while editing the same markdown files that Docs Viewer publishes.

The plugin folder is:

```text
plugins-obsidian/playmap/
```

Copy that folder into an Obsidian vault as:

```text
.obsidian/plugins/playmap/
```

It intentionally lives in this repository for now because the shared markdown/frontmatter contract is still evolving. A separate repository starts to make sense when the Obsidian plugin needs its own release process, issue tracker, versioning, or publication flow for the Obsidian community plugin ecosystem.

## Git Hygiene

Ignored by default:

- `.env` and other local env files;
- `docs-viewer.config.json`;
- `node_modules/`;
- copied viewer assets in `viewer/data/assets/`;
- local Obsidian workspace files in `.obsidian/`;
- `.DS_Store`.

Commit `docs-viewer.config.example.json` and `.env.example`, not private local config or secrets.
