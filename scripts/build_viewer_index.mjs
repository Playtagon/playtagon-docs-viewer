#!/usr/bin/env node

import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "./load_env.mjs";

await loadEnv();

const configFile = path.resolve("docs-viewer.config.json");
const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx"]);
const ASSET_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".ico"]);
const DEFAULT_CONFIG = {
  app: {
    title: "Docs Viewer",
  },
  source: {
    type: "local",
    local: { path: "docs-sample" },
    github: {
      owner: "your-org",
      repo: "your-docs-repo",
      branch: "main",
      path: "",
    },
  },
  roadmap: {
    includedFolders: ["04-Roadmap-Sample"],
    excludedFolders: [],
    hideUndated: false,
  },
  ignoredFolders: [
    ".git",
    ".claude",
    ".obsidian",
    ".trash",
    "node_modules",
    "__pycache__",
    ".github/workflows",
    "apps/internal",
    "docs/superpowers",
    "scripts",
  ],
};

const config = applyEnvOverrides(await loadConfig());
const rootArg = process.argv[2] || config.source?.local?.path || "docs-sample";
const outArg = process.argv[3] || "viewer/data/vault-index.json";
const rootDir = path.resolve(rootArg);
const outFile = path.resolve(outArg);
const viewerPluginSourceDir = path.resolve("plugins");
const viewerPluginOutDir = path.resolve("viewer/plugins");

const SKIP_DIRS = new Set(config.ignoredFolders || [".git", ".obsidian", ".trash", "node_modules", "__pycache__"]);

async function loadConfig() {
  try {
    return JSON.parse(await readFile(configFile, "utf8"));
  } catch {
    return DEFAULT_CONFIG;
  }
}

function envValue(key) {
  const value = process.env[key];
  return value === undefined || String(value).trim() === "" ? undefined : String(value).trim();
}

function envList(key) {
  return envValue(key)
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function envBoolean(key) {
  const value = envValue(key);
  if (value === undefined) return undefined;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function applyEnvOverrides(inputConfig) {
  const next = JSON.parse(JSON.stringify(inputConfig || DEFAULT_CONFIG));

  const appTitle = envValue("DOCS_VIEWER_APP_TITLE");
  if (appTitle) {
    next.app ||= {};
    next.app.title = appTitle;
  }

  const sourceType = envValue("DOCS_VIEWER_SOURCE_TYPE");
  if (sourceType) {
    next.source ||= {};
    next.source.type = sourceType;
  }

  const localPath = envValue("DOCS_VIEWER_LOCAL_PATH");
  if (localPath) {
    next.source ||= {};
    next.source.local ||= {};
    next.source.local.path = localPath;
  }

  const githubOwner = envValue("DOCS_VIEWER_GITHUB_OWNER");
  const githubRepo = envValue("DOCS_VIEWER_GITHUB_REPO");
  const githubBranch = envValue("DOCS_VIEWER_GITHUB_BRANCH");
  const githubPath = envValue("DOCS_VIEWER_GITHUB_PATH");
  if (githubOwner || githubRepo || githubBranch || githubPath !== undefined) {
    next.source ||= {};
    next.source.github ||= {};
    if (githubOwner) next.source.github.owner = githubOwner;
    if (githubRepo) next.source.github.repo = githubRepo;
    if (githubBranch) next.source.github.branch = githubBranch;
    if (githubPath !== undefined) next.source.github.path = githubPath;
  }

  const includedFolders = envList("DOCS_VIEWER_ROADMAP_INCLUDED_FOLDERS");
  const excludedFolders = envList("DOCS_VIEWER_ROADMAP_EXCLUDED_FOLDERS");
  const hideUndated = envBoolean("DOCS_VIEWER_ROADMAP_HIDE_UNDATED");
  if (includedFolders || excludedFolders || hideUndated !== undefined) {
    next.roadmap ||= {};
    if (includedFolders) next.roadmap.includedFolders = includedFolders;
    if (excludedFolders) next.roadmap.excludedFolders = excludedFolders;
    if (hideUndated !== undefined) next.roadmap.hideUndated = hideUndated;
  }

  const ignoredFolders = envList("DOCS_VIEWER_IGNORED_FOLDERS");
  if (ignoredFolders) {
    next.ignoredFolders = ignoredFolders;
  }

  return next;
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function normalizeRepoPath(value) {
  const normalized = String(value || "").replace(/^\/+|\/+$/g, "");
  return normalized === "." ? "" : normalized;
}

function isIgnoredPath(relativePath) {
  const normalized = toPosix(relativePath).replace(/^\/+|\/+$/g, "");
  return [...SKIP_DIRS].some((ignored) => {
    const clean = String(ignored).replace(/^\/+|\/+$/g, "");
    return normalized === clean || normalized.startsWith(`${clean}/`) || normalized.split("/").includes(clean);
  });
}

function normalizeFolderList(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item || "").replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);
}

function stripNumericPrefix(value) {
  return value.replace(/^\d+[\s._-]+/, "");
}

function routePart(value) {
  return slugify(stripNumericPrefix(value));
}

function displayName(value) {
  return stripNumericPrefix(value).replace(/[-_]+/g, " ").trim();
}

function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed.replace(/^["']|["']$/g, "");
}

function parseFrontmatter(raw) {
  if (!raw.startsWith("---\n")) {
    return { frontmatter: {}, body: raw };
  }

  const end = raw.indexOf("\n---", 4);
  if (end === -1) {
    return { frontmatter: {}, body: raw };
  }

  const yaml = raw.slice(4, end).trimEnd();
  const body = raw.slice(raw.indexOf("\n", end + 1) + 1);
  const frontmatter = {};
  const lines = yaml.split(/\r?\n/);
  let currentArrayKey = null;
  let currentObject = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    const arrayItemMatch = line.match(/^\s*-\s*(.*)$/);
    if (arrayItemMatch && currentArrayKey) {
      const value = arrayItemMatch[1];
      if (!value) {
        currentObject = {};
        frontmatter[currentArrayKey].push(currentObject);
        continue;
      }

      const pair = value.match(/^([^:]+):\s*(.*)$/);
      if (pair) {
        currentObject = { [pair[1].trim()]: parseScalar(pair[2]) };
        frontmatter[currentArrayKey].push(currentObject);
      } else {
        currentObject = null;
        frontmatter[currentArrayKey].push(parseScalar(value));
      }
      continue;
    }

    const nestedPair = line.match(/^\s+([^:]+):\s*(.*)$/);
    if (nestedPair && currentObject) {
      currentObject[nestedPair[1].trim()] = parseScalar(nestedPair[2]);
      continue;
    }

    const pair = line.match(/^([^:]+):\s*(.*)$/);
    if (!pair) continue;

    const key = pair[1].trim();
    const value = pair[2].trim();
    currentObject = null;

    if (!value) {
      frontmatter[key] = [];
      currentArrayKey = key;
    } else if (value.startsWith("[") && value.endsWith("]")) {
      frontmatter[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => parseScalar(item))
        .filter(Boolean);
      currentArrayKey = null;
    } else {
      frontmatter[key] = parseScalar(value);
      currentArrayKey = null;
    }
  }

  return { frontmatter, body };
}

function extractHeadings(body) {
  return body
    .split(/\r?\n/)
    .map((line) => line.match(/^(#{1,4})\s+(.+)$/))
    .filter(Boolean)
    .map((match) => ({
      level: match[1].length,
      text: match[2].replace(/#+$/, "").trim(),
      slug: slugify(match[2].replace(/#+$/, "").trim()),
    }));
}

function extractLinks(body) {
  const links = [];
  const pattern = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;
  let match;
  while ((match = pattern.exec(body))) {
    const target = match[1].replace(/\\+$/, "").trim();
    const heading = match[2]?.replace(/\\+$/, "").trim() || "";
    const label = match[3]?.trim() || target;
    links.push({
      target,
      heading,
      label,
    });
  }
  return links;
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".obsidian") continue;
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(rootDir, fullPath);
    if (isIgnoredPath(relativePath)) continue;

    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    if (entry.isFile() && MARKDOWN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

async function walkAssets(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".obsidian") continue;
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(rootDir, fullPath);
    if (isIgnoredPath(relativePath)) continue;

    if (entry.isDirectory()) {
      files.push(...(await walkAssets(fullPath)));
      continue;
    }

    if (entry.isFile() && ASSET_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

async function copyViewerPlugins() {
  let entries = [];
  try {
    entries = await readdir(viewerPluginSourceDir, { withFileTypes: true });
  } catch {
    return 0;
  }

  await rm(viewerPluginOutDir, { recursive: true, force: true });
  let copied = 0;

  async function copyDir(sourceDir, outputDir) {
    await mkdir(outputDir, { recursive: true });
    const childEntries = await readdir(sourceDir, { withFileTypes: true });
    for (const entry of childEntries) {
      if (entry.name.startsWith(".")) continue;
      const sourcePath = path.join(sourceDir, entry.name);
      const outputPath = path.join(outputDir, entry.name);
      if (entry.isDirectory()) {
        await copyDir(sourcePath, outputPath);
      } else if (entry.isFile()) {
        await copyFile(sourcePath, outputPath);
        copied += 1;
      }
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    await copyDir(path.join(viewerPluginSourceDir, entry.name), path.join(viewerPluginOutDir, entry.name));
  }

  return copied;
}

function buildTree(files) {
  const root = { name: "docs", path: "", children: [], pages: [] };
  const byPath = new Map([["", root]]);

  for (const file of files) {
    const parts = file.path.split("/");
    const fileName = parts.pop();
    let current = root;
    let currentPath = "";

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!byPath.has(currentPath)) {
        const node = {
          name: displayName(part),
          rawName: part,
          path: currentPath,
          children: [],
          pages: [],
        };
        byPath.set(currentPath, node);
        current.children.push(node);
      }
      current = byPath.get(currentPath);
    }

    current.pages.push({
      title: file.title,
      slug: file.slug,
      path: file.path,
      fileName,
      isIndex: file.isIndex,
    });

    if (file.isIndex) {
      current.name = file.title;
    }
  }

  return root;
}

function isIndexFile(relativePath, frontmatterTitle) {
  const parsed = path.posix.parse(relativePath);
  const folderName = stripNumericPrefix(path.posix.basename(parsed.dir || ""));
  const baseName = stripNumericPrefix(parsed.name);
  return parsed.name.toLowerCase() === "index" || slugify(baseName) === slugify(folderName) || slugify(frontmatterTitle) === slugify(folderName);
}

async function fetchGitHubJson(url, token) {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "docs-viewer",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function readGitHubBlob(owner, repo, sha, token) {
  const blob = await fetchGitHubJson(`https://api.github.com/repos/${owner}/${repo}/git/blobs/${sha}`, token);
  return Buffer.from(blob.content || "", "base64");
}

async function loadGitHubSource(source) {
  const { owner, repo, branch = "main" } = source.github || {};
  const sourcePath = normalizeRepoPath(source.github?.path);
  const token = process.env.DOCS_VIEWER_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";

  if (!owner || !repo) {
    throw new Error("GitHub source requires owner and repo in docs-viewer.config.json");
  }

  const tree = await fetchGitHubJson(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    token,
  );
  const files = tree.tree
    .filter((entry) => entry.type === "blob")
    .filter((entry) => !sourcePath || entry.path === sourcePath || entry.path.startsWith(`${sourcePath}/`))
    .map((entry) => ({
      ...entry,
      relativePath: sourcePath ? entry.path.slice(sourcePath.length).replace(/^\//, "") : entry.path,
    }))
    .filter((entry) => {
      const extension = path.posix.extname(entry.relativePath).toLowerCase();
      return MARKDOWN_EXTENSIONS.has(extension) || ASSET_EXTENSIONS.has(extension);
    })
    .filter((entry) => entry.relativePath && !isIgnoredPath(entry.relativePath));

  return Promise.all(
    files.map(async (entry) => ({
      path: entry.relativePath,
      content: await readGitHubBlob(owner, repo, entry.sha, token),
    })),
  );
}

async function loadLocalSource() {
  const markdownFiles = (await walk(rootDir)).sort((a, b) => toPosix(a).localeCompare(toPosix(b)));
  const assetFiles = (await walkAssets(rootDir)).sort((a, b) => toPosix(a).localeCompare(toPosix(b)));
  const files = [];

  for (const absolutePath of markdownFiles) {
    files.push({
      absolutePath,
      path: toPosix(path.relative(rootDir, absolutePath)),
      content: await readFile(absolutePath),
    });
  }

  for (const absolutePath of assetFiles) {
    files.push({
      absolutePath,
      path: toPosix(path.relative(rootDir, absolutePath)),
      content: await readFile(absolutePath),
    });
  }

  return files;
}

const copiedPluginFiles = await copyViewerPlugins();
const sourceFiles = config.source?.type === "github" ? await loadGitHubSource(config.source) : await loadLocalSource();
const markdownFiles = sourceFiles
  .filter((file) => MARKDOWN_EXTENSIONS.has(path.posix.extname(file.path).toLowerCase()))
  .sort((a, b) => a.path.localeCompare(b.path));
const assetFiles = sourceFiles
  .filter((file) => ASSET_EXTENSIONS.has(path.posix.extname(file.path).toLowerCase()))
  .sort((a, b) => a.path.localeCompare(b.path));
const pages = [];
const aliases = new Map();
const assets = {};

for (const assetFile of assetFiles) {
  const relativePath = assetFile.path;
  const outputPath = `assets/${relativePath}`;
  const outputFile = path.resolve(path.dirname(outFile), outputPath);

  await mkdir(path.dirname(outputFile), { recursive: true });
  if (assetFile.absolutePath) {
    await copyFile(assetFile.absolutePath, outputFile);
  } else {
    await writeFile(outputFile, assetFile.content);
  }

  assets[relativePath.toLowerCase()] = outputPath;
  assets[path.posix.basename(relativePath).toLowerCase()] ||= outputPath;
}

for (const markdownFile of markdownFiles) {
  const relativePath = markdownFile.path;
  const raw = markdownFile.content.toString("utf8");
  const { frontmatter, body } = parseFrontmatter(raw);
  const basename = path.posix.basename(relativePath, path.posix.extname(relativePath));
  const title = frontmatter.title || stripNumericPrefix(basename);
  const slug = relativePath.replace(/\.(mdx?|MDX?)$/, "").split("/").map(routePart).join("/");
  const headings = extractHeadings(body);
  const wikilinks = extractLinks(body);
  const page = {
    id: relativePath,
    path: relativePath,
    slug,
    title,
    description: frontmatter.description || "",
    frontmatter,
    body,
    headings,
    wikilinks,
    isIndex: isIndexFile(relativePath, title),
    folder: toPosix(path.dirname(relativePath)).replace(/^\.$/, ""),
    basename,
  };

  pages.push(page);
  aliases.set(basename.toLowerCase(), page.slug);
  aliases.set(title.toLowerCase(), page.slug);

  for (const alias of Array.isArray(frontmatter.aliases) ? frontmatter.aliases : []) {
    aliases.set(String(alias).toLowerCase(), page.slug);
  }
}

const pageBySlug = new Map(pages.map((page) => [page.slug, page]));
const routeAliases = {};

for (const page of pages) {
  const legacyNumericSlug = page.path.replace(/\.(mdx?|MDX?)$/, "").split("/").map(slugify).join("/");
  routeAliases[legacyNumericSlug] = page.slug;

  const noNumericSlug = page.path
    .replace(/\.(mdx?|MDX?)$/, "")
    .split("/")
    .map(routePart)
    .join("/");
  routeAliases[noNumericSlug] = page.slug;
}

for (const page of pages) {
  const folderSlug = page.folder
    .split("/")
    .filter(Boolean)
    .map(routePart)
    .join("/");
  if (!folderSlug || routeAliases[folderSlug]) continue;

  if (page.isIndex) {
    routeAliases[folderSlug] = page.slug;
  }
}

const resolvedLinks = {};
const backlinks = {};

for (const page of pages) {
  resolvedLinks[page.slug] = page.wikilinks.map((link) => {
    const targetSlug = aliases.get(link.target.toLowerCase()) || "";
    if (targetSlug) {
      backlinks[targetSlug] ||= [];
      backlinks[targetSlug].push({ slug: page.slug, title: page.title });
    }
    return { ...link, slug: targetSlug, exists: Boolean(targetSlug && pageBySlug.has(targetSlug)) };
  });
}

const index = {
  generatedAt: new Date().toISOString(),
  app: {
    title: config.app?.title || "Docs Viewer",
  },
  source: config.source?.type === "github"
    ? {
        type: "github",
        owner: config.source.github?.owner || "",
        repo: config.source.github?.repo || "",
        branch: config.source.github?.branch || "main",
        path: normalizeRepoPath(config.source.github?.path),
      }
    : {
        type: "local",
        path: toPosix(path.relative(process.cwd(), rootDir)) || ".",
      },
  sourceRoot: config.source?.type === "github"
    ? `${config.source.github?.owner || ""}/${config.source.github?.repo || ""}`
    : toPosix(path.relative(process.cwd(), rootDir)) || ".",
  roadmap: {
    includedFolders: normalizeFolderList(config.roadmap?.includedFolders),
    excludedFolders: normalizeFolderList(config.roadmap?.excludedFolders),
    hideUndated: Boolean(config.roadmap?.hideUndated),
  },
  pages,
  tree: buildTree(pages),
  aliases: Object.fromEntries([...aliases.entries()].sort()),
  routeAliases,
  assets,
  resolvedLinks,
  backlinks,
};

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, `${JSON.stringify(index, null, 2)}\n`, "utf8");

console.log(`Wrote ${toPosix(path.relative(process.cwd(), outFile))}`);
console.log(`Indexed ${pages.length} pages from ${index.sourceRoot}`);
console.log(`Copied ${assetFiles.length} assets`);
console.log(`Copied ${copiedPluginFiles} viewer plugin files`);
