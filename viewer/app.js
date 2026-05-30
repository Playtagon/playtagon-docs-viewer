import {
  STATUS_OPTIONS,
  TIMELINE_SCALES,
  buildRoadmapModel,
  buildTimeline,
  clamp,
  featureItems,
  formatDate,
  percentBetween,
} from "./plugins/roadmap/model.js";

const state = {
  data: null,
  auth: null,
  route: "",
  roadmapMode: "timeline",
  roadmapScale: "month",
  hideUndatedRoadmap: false,
  collapsedRoadmapGroups: new Set(),
  collapsedBoardColumns: new Set(),
  query: "",
  collapsedFolders: new Set(),
  currentPageSlug: "",
  tocScrollHandler: null,
  mobileNavOpen: false,
};

const els = {
  brand: document.querySelector(".brand"),
  tree: document.querySelector("#tree"),
  content: document.querySelector("#content"),
  breadcrumbs: document.querySelector("#breadcrumbs"),
  pageMeta: document.querySelector("#pageMeta"),
  searchInput: document.querySelector("#searchInput"),
  searchToggle: document.querySelector("#searchToggle"),
  roadmapLink: document.querySelector("#roadmapLink"),
  settingsLink: document.querySelector("#settingsLink"),
  expandTree: document.querySelector("#expandTree"),
  collapseTree: document.querySelector("#collapseTree"),
  mobileMenuToggle: document.querySelector("#mobileMenuToggle"),
  refreshDocs: document.querySelector("#refreshDocs"),
  authStatus: document.querySelector("#authStatus"),
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function stripNumericPrefix(value) {
  return String(value || "").replace(/^\d+[\s._-]+/, "");
}

function breadcrumbLabel(value) {
  return stripNumericPrefix(value).replace(/[-_]+/g, " ").trim();
}

function pageHref(slug) {
  return slug ? `/${slug}` : "/";
}

function icon(name) {
  return `<i class="ti ti-${name}" aria-hidden="true"></i>`;
}

function appTitle() {
  return state.data?.app?.title || "Docs Viewer";
}

function setDocumentTitle(title) {
  document.title = `${title} · ${appTitle()}`;
}

function setBrandTitle() {
  if (els.brand) els.brand.textContent = appTitle();
  document.querySelector(".mobile-brand")?.replaceChildren(document.createTextNode(appTitle()));
}

function applyFavicon() {
  const assets = state.data?.assets || {};
  const faviconPath =
    assets["favicon.ico"] ||
    assets["favicon.png"] ||
    assets["favicon.svg"] ||
    Object.entries(assets).find(([key]) => /(^|\/)favicon\.(ico|png|svg)$/i.test(key))?.[1];
  if (!faviconPath) return;

  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.append(link);
  }
  link.href = `/data/${faviconPath}`;
}

function folderId(path) {
  return `folder-${slugify(path || "root")}`;
}

function currentRoute() {
  if (location.hash.startsWith("#/")) {
    return decodeURIComponent(location.hash.replace(/^#\/?/, "").split("#")[0]);
  }
  return decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g, ""));
}

function findPage(slug) {
  if (!slug) {
    return state.data.pages.find((page) => page.path.toLowerCase() === "readme.md")
      || state.data.pages.find((page) => page.path.toLowerCase() === "index.md")
      || state.data.pages[0];
  }
  const resolvedSlug = state.data.routeAliases?.[slug] || slug;
  return state.data.pages.find((page) => page.slug === resolvedSlug) || null;
}

async function loadVaultIndex() {
  const response = await fetch(`/data/vault-index.json?ts=${Date.now()}`, { cache: "no-store" });
  if (response.status === 401) {
    location.assign("/__auth/login");
    throw new Error("Authentication required");
  }
  if (!response.ok) {
    throw new Error(`Failed to load vault index: ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Failed to load vault index: server returned HTML instead of JSON");
  }
  return response.json();
}

function setRefreshState(label, disabled = false) {
  if (!els.refreshDocs) return;
  els.refreshDocs.innerHTML = `${icon(label === "Refreshing" ? "loader-2" : "refresh")}<span>${escapeHtml(label)}</span>`;
  els.refreshDocs.disabled = disabled;
}

function sourcePathForPage(page) {
  const source = state.data?.source;
  if (source?.type === "github") {
    return [source.path, page.path].filter(Boolean).join("/");
  }
  return [source?.path, page.path].filter(Boolean).join("/");
}

function sourceHrefForPage(page) {
  const source = state.data?.source;
  if (source?.type !== "github" || !source.owner || !source.repo) return "";
  const filePath = sourcePathForPage(page)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `https://github.com/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}/blob/${encodeURI(
    source.branch || "main",
  )}/${filePath}`;
}

function renderSourceMeta(page) {
  const sourcePath = sourcePathForPage(page);
  const href = sourceHrefForPage(page);
  const label = `Source: ${sourcePath}`;
  const displayName = state.data?.source?.type === "github" ? "Source" : page.fileName || page.path.split("/").pop() || "Source";
  const content = `${icon("external-link")}<span>${escapeHtml(displayName)}</span>`;
  return href
    ? `<a class="source-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer" title="${escapeHtml(label)}">${content}</a>`
    : `<span class="source-link is-static" title="${escapeHtml(label)}">${content}</span>`;
}

function folderRouteSlug(folderPath) {
  return String(folderPath || "")
    .split("/")
    .filter(Boolean)
    .map((part) => slugify(stripNumericPrefix(part)))
    .join("/");
}

function pageForFolderPath(folderPath) {
  const routeSlug = folderRouteSlug(folderPath);
  const resolvedSlug = state.data.routeAliases?.[routeSlug] || routeSlug;
  return state.data.pages.find((item) => item.slug === resolvedSlug) || null;
}

function collapseBreadcrumbItems(items) {
  if (items.length <= 5) return items;
  return [items[0], items[1], { type: "ellipsis" }, ...items.slice(-2)];
}

function renderBreadcrumbs(page) {
  const homePage = findPage("");
  if (homePage?.slug === page.slug) {
    return `<nav id="breadcrumbs" class="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        <li><span aria-current="page">Home</span></li>
      </ol>
    </nav>`;
  }

  const items = [
    {
      label: "Home",
      href: "/",
    },
  ];
  const folderParts = String(page.folder || "")
    .split("/")
    .filter(Boolean);
  let currentPath = "";

  for (const part of folderParts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    const folderPage = pageForFolderPath(currentPath);
    const isCurrentFolderIndex = page.isIndex && folderPage?.slug === page.slug;
    items.push({
      label: breadcrumbLabel(part),
      href: folderPage && folderPage.slug !== page.slug ? pageHref(folderPage.slug) : "",
      current: isCurrentFolderIndex,
    });
  }

  if (page.isIndex && folderParts.length && !items.some((item) => item.current)) {
    items[items.length - 1].current = true;
    items[items.length - 1].href = "";
  }

  if (!page.isIndex || !folderParts.length) {
    items.push({ label: page.title, current: true });
  }

  return `<nav id="breadcrumbs" class="breadcrumbs" aria-label="Breadcrumb">
    <ol>
      ${collapseBreadcrumbItems(items)
        .map((item) => {
          if (item.type === "ellipsis") {
            return `<li class="breadcrumb-ellipsis" aria-hidden="true">...</li>`;
          }
          if (item.current) {
            return `<li><span aria-current="page">${escapeHtml(item.label)}</span></li>`;
          }
          return `<li>${
            item.href
              ? `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`
              : `<span>${escapeHtml(item.label)}</span>`
          }</li>`;
        })
        .join("")}
    </ol>
  </nav>`;
}

function scrollRouteToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  els.content?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
}

function scrollOffset() {
  const topbar = document.querySelector(".topbar");
  const topbarPosition = topbar ? getComputedStyle(topbar).position : "";
  const topbarHeight = topbarPosition === "fixed" || topbarPosition === "sticky" ? topbar.getBoundingClientRect().height : 0;
  return topbarHeight + 20;
}

function routeHash() {
  if (!location.hash || location.hash.startsWith("#/")) return "";
  return decodeURIComponent(location.hash.slice(1));
}

function scrollToHash({ behavior = "auto" } = {}) {
  const hash = routeHash();
  if (!hash) return false;
  const target = document.getElementById(hash);
  if (!target) return false;
  requestAnimationFrame(() => {
    const top = target.getBoundingClientRect().top + window.scrollY - scrollOffset();
    window.scrollTo({ top: Math.max(0, top), left: 0, behavior });
  });
  return true;
}

function samePageHashLink(url) {
  return url.hash && url.pathname === location.pathname && url.search === location.search;
}

function expandFolderPath(folderPath) {
  const parts = String(folderPath || "")
    .split("/")
    .filter(Boolean);
  let currentPath = "";
  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    state.collapsedFolders.delete(currentPath);
  }
}

function currentTreePage() {
  return state.data?.pages.find((page) => page.slug === state.currentPageSlug) || null;
}

function scrollActiveTreeLink() {
  const activeLink = els.tree.querySelector(".tree-link.is-active");
  if (!activeLink) return;
  requestAnimationFrame(() => {
    activeLink.scrollIntoView({ block: "center", inline: "nearest" });
  });
}

function navigateTo(href, replace = false) {
  const url = new URL(href, location.origin);
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${location.pathname}${location.search}${location.hash}`;
  if (next !== current) {
    history[replace ? "replaceState" : "pushState"](null, "", next);
  }
  renderRoute();
}

async function loadViewerConfig() {
  const response = await fetch("/__config", { cache: "no-store" });
  if (!response.ok) throw new Error("Settings API is unavailable in this build");
  return response.json();
}

async function loadAuthStatus() {
  try {
    const response = await fetch("/__auth/me", { cache: "no-store" });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function renderAuthStatus(auth) {
  if (!els.authStatus || !auth?.authenticated) return;
  els.authStatus.hidden = false;
  els.authStatus.innerHTML = `<div>
    <span>${escapeHtml(auth.email)}</span>
    <small>${escapeHtml(auth.isAdmin ? `${auth.provider} admin` : auth.provider)}</small>
  </div>
  <a href="/__auth/logout">Sign out</a>`;
}

function canAccessSettings(auth) {
  return Boolean(auth?.authenticated && auth.isAdmin);
}

function applyAdminUi(auth) {
  if (canAccessSettings(auth)) return;
  els.settingsLink?.remove();
}

async function saveViewerConfig(config) {
  const response = await fetch("/__config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!response.ok) throw new Error("Could not save settings");
  return response.json();
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (_, target, heading, label) => {
      const cleanTarget = String(target).replace(/\\+$/, "").trim();
      const cleanHeading = heading ? String(heading).replace(/\\+$/, "").trim() : "";
      const cleanLabel = label?.trim() || cleanTarget;
      const slug = state.data.aliases[cleanTarget.toLowerCase()];
      const hash = cleanHeading ? `#${slugify(cleanHeading)}` : "";
      return slug
        ? `<a href="${pageHref(slug)}${hash}">${escapeHtml(cleanLabel)}</a>`
        : `<span title="Missing page" class="missing-link">${escapeHtml(cleanLabel)}</span>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function resolveAssetPath(target) {
  const cleanTarget = String(target || "").trim().replace(/^\.?\//, "");
  if (/^(https?:)?\/\//.test(cleanTarget) || cleanTarget.startsWith("data:")) {
    return cleanTarget;
  }

  const key = decodeURIComponent(cleanTarget).toLowerCase();
  const assetPath = state.data.assets?.[key] || state.data.assets?.[key.split("/").pop()];
  return assetPath ? `./data/${assetPath}` : "";
}

function renderImage(target, alt = "") {
  const src = resolveAssetPath(target);
  const label = alt || target;
  if (!src) {
    return `<span class="missing-asset">Missing image: ${escapeHtml(label)}</span>`;
  }

  return `<figure class="doc-image">
    <img src="${escapeHtml(src)}" alt="${escapeHtml(label)}" loading="lazy" />
    ${alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : ""}
  </figure>`;
}

function renderImageLine(line) {
  const obsidianImage = line.trim().match(/^!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
  if (obsidianImage) {
    return renderImage(obsidianImage[1], obsidianImage[2] || "");
  }

  const markdownImage = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (markdownImage) {
    return renderImage(markdownImage[2], markdownImage[1] || "");
  }

  return "";
}

function renderCardsBlock(block) {
  const cards = [...block.matchAll(/<Card\s+title="([^"]+)"\s+href="([^"]+)">\s*([\s\S]*?)\s*<\/Card>/g)];
  if (!cards.length) return "";
  return `<div class="cards">${cards
    .map((card) => {
      const href = card[2].startsWith("/docs/")
        ? `#/${state.data.routeAliases?.[card[2].replace(/^\/docs\//, "")] || card[2].replace(/^\/docs\//, "")}`
        : card[2];
      return `<a class="doc-card" href="${escapeHtml(href)}"><span class="doc-card-title">${escapeHtml(
        card[1],
      )}</span><span class="doc-card-body">${inlineMarkdown(card[3].trim())}</span></a>`;
    })
    .join("")}</div>`;
}

function renderTable(lines) {
  const rows = lines
    .filter((line, index) => index !== 1 || !/^\s*\|?\s*:?-{3,}/.test(line))
    .map((line, index) => {
      const cells = splitTableRow(line);
      const tag = index === 0 ? "th" : "td";
      return `<tr>${cells.map((cell) => `<${tag}>${inlineMarkdown(cell)}</${tag}>`).join("")}</tr>`;
    });
  return `<table>${rows.join("")}</table>`;
}

function splitTableRow(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let current = "";
  let escaped = false;

  for (const char of trimmed) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function isTableSeparator(line) {
  const cells = splitTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isTableStart(line, nextLine) {
  return line.includes("|") && Boolean(nextLine) && isTableSeparator(nextLine);
}

function isTableRow(line) {
  return line.includes("|") && /^\s*\|?(.+\|)+/.test(line);
}

function renderMarkdown(raw) {
  const withoutFrontmatter = raw.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const blocks = [];
  const lines = withoutFrontmatter.split(/\r?\n/);
  let paragraph = [];
  let list = null;
  let table = [];
  let code = null;
  let quote = [];

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  }

  function flushList() {
    if (list?.items.length) {
      blocks.push(`<${list.type}>${list.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</${list.type}>`);
      list = null;
    }
  }

  function flushTable() {
    if (table.length) {
      blocks.push(renderTable(table));
      table = [];
    }
  }

  function flushQuote() {
    if (quote.length) {
      blocks.push(`<blockquote>${quote.map((line) => `<p>${inlineMarkdown(line)}</p>`).join("")}</blockquote>`);
      quote = [];
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.trim().startsWith("<Cards>")) {
      flushParagraph();
      flushList();
      flushTable();
      flushQuote();
      const cardLines = [];
      while (index < lines.length && !lines[index].trim().startsWith("</Cards>")) {
        cardLines.push(lines[index]);
        index += 1;
      }
      cardLines.push(lines[index] || "");
      blocks.push(renderCardsBlock(cardLines.join("\n")));
      continue;
    }

    const codeFence = line.match(/^```(\w+)?/);
    if (codeFence) {
      if (code) {
        blocks.push(`<pre><code>${escapeHtml(code.lines.join("\n"))}</code></pre>`);
        code = null;
      } else {
        flushParagraph();
        flushList();
        flushTable();
        flushQuote();
        code = { lang: codeFence[1] || "", lines: [] };
      }
      continue;
    }

    if (code) {
      code.lines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushTable();
      flushQuote();
      continue;
    }

    const image = renderImageLine(line);
    if (image) {
      flushParagraph();
      flushList();
      flushTable();
      flushQuote();
      blocks.push(image);
      continue;
    }

    if (isTableStart(line, lines[index + 1])) {
      flushParagraph();
      flushList();
      flushQuote();
      table.push(line);
      continue;
    }

    if (table.length && isTableRow(line)) {
      table.push(line);
      continue;
    }

    flushTable();

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = heading[1].length;
      const text = heading[2].replace(/#+$/, "").trim();
      blocks.push(`<h${level} id="${slugify(text)}">${inlineMarkdown(text)}</h${level}>`);
      continue;
    }

    const listItem = line.match(/^\s*[-*]\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      flushQuote();
      if (list?.type !== "ul") flushList();
      list ||= { type: "ul", items: [] };
      list.items.push(listItem[1]);
      continue;
    }

    const orderedListItem = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (orderedListItem) {
      flushParagraph();
      flushQuote();
      if (list?.type !== "ol") flushList();
      list ||= { type: "ol", items: [] };
      list.items.push(orderedListItem[1]);
      continue;
    }

    const quoteLine = line.match(/^>\s?(.*)$/);
    if (quoteLine) {
      flushParagraph();
      flushList();
      quote.push(quoteLine[1]);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushTable();
  flushQuote();

  return blocks.join("\n");
}

function nodeContainsActivePage(node, activeSlug) {
  return node.pages.some((page) => page.slug === activeSlug)
    || node.children.some((child) => nodeContainsActivePage(child, activeSlug));
}

function renderTreeNode(node, depth = 0) {
  const query = state.query.trim().toLowerCase();
  const pages = node.pages
    .filter((page) => !query || `${page.title} ${page.path}`.toLowerCase().includes(query))
    .sort((a, b) => Number(b.isIndex) - Number(a.isIndex) || a.title.localeCompare(b.title));
  const children = node.children
    .map((child) => renderTreeNode(child, depth + 1))
    .filter(Boolean)
    .join("");

  if (!pages.length && !children) return "";

  const active = state.route;
  const isCollapsed = !query && state.collapsedFolders.has(node.path);
  const isActiveBranch = nodeContainsActivePage(node, active);
  const folderButton = node.path
    ? `<button class="tree-folder" type="button" data-folder-path="${escapeHtml(node.path)}" aria-expanded="${
        isCollapsed ? "false" : "true"
      }" aria-controls="${folderId(node.path)}">
        <span class="tree-folder-chevron" aria-hidden="true"></span>
        <span class="tree-folder-label">${escapeHtml(node.name)}</span>
      </button>`
    : "";
  const pageLinks = pages
    .map(
      (page) =>
        `<a class="tree-link ${page.slug === active ? "is-active" : ""}" href="${pageHref(page.slug)}">${escapeHtml(
          page.title,
        )}</a>`,
    )
    .join("");

  const depthIndent = depth * 14;
  const lineLeft = 12 + Math.max(0, depth - 1) * 14;
  return `<div class="tree-group ${isCollapsed ? "is-collapsed" : ""} ${
    isActiveBranch ? "is-active-branch" : ""
  }" data-depth="${depth}" style="--depth:${depth};--depth-indent:${depthIndent}px;--line-left:${lineLeft}px">
    ${folderButton}
    <div id="${node.path ? folderId(node.path) : ""}" class="tree-children">
      <div class="tree-pages">${pageLinks}</div>
      ${children}
    </div>
  </div>`;
}

function collectFolderPaths(node, paths = []) {
  for (const child of node.children) {
    paths.push(child.path);
    collectFolderPaths(child, paths);
  }
  return paths;
}

function renderTree({ scrollActive = true } = {}) {
  els.tree.innerHTML = renderTreeNode(state.data.tree);
  els.tree.querySelectorAll("[data-folder-path]").forEach((button) => {
    button.addEventListener("click", () => {
      const path = button.dataset.folderPath;
      if (state.collapsedFolders.has(path)) {
        state.collapsedFolders.delete(path);
      } else {
        state.collapsedFolders.add(path);
      }
      renderTree({ scrollActive: false });
    });
  });
  if (scrollActive) scrollActiveTreeLink();
}

function setMobileNavOpen(open) {
  state.mobileNavOpen = open;
  document.body.classList.toggle("is-mobile-nav-open", open);
  if (!els.mobileMenuToggle) return;
  els.mobileMenuToggle.setAttribute("aria-expanded", String(open));
  els.mobileMenuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  els.mobileMenuToggle.innerHTML = icon(open ? "x" : "menu-2");
}

function setSearchOpen(open) {
  const search = document.querySelector(".search");
  search?.classList.toggle("is-open", open);
  els.searchToggle?.setAttribute("aria-expanded", String(open));
  if (open) {
    requestAnimationFrame(() => els.searchInput?.focus());
  }
}

function renderBacklinks(page) {
  const links = state.data.backlinks[page.slug] || [];
  if (!links.length) return "";
  return `<aside class="backlinks"><h2>Linked mentions</h2><div class="backlink-list">${links
    .map(
      (link) => `<a class="backlink-chip" href="${pageHref(link.slug)}">
        ${icon("file-text")}
        <span>${escapeHtml(link.title)}</span>
      </a>`,
    )
    .join("")}</div></aside>`;
}

function pageTocItems(body) {
  return String(body || "")
    .split(/\r?\n/)
    .map((line) => line.match(/^(#{2,4})\s+(.+)$/))
    .filter(Boolean)
    .map((heading) => {
      const text = heading[2].replace(/#+$/, "").trim();
      return {
        id: slugify(text),
        level: heading[1].length,
        text,
      };
    });
}

function renderPageToc(page) {
  const items = pageTocItems(page.body);
  if (!items.length) return "";
  return `<aside class="page-toc" aria-label="Table of contents">
    <div class="page-toc-title">On this page</div>
    <nav>
      ${items
        .map(
          (item) =>
            `<a class="page-toc-link" data-toc-id="${escapeHtml(item.id)}" style="--toc-depth:${item.level - 2}" href="#${escapeHtml(
              item.id,
            )}">${escapeHtml(item.text)}</a>`,
        )
        .join("")}
    </nav>
  </aside>`;
}

function setActiveTocItem(id) {
  const links = els.content.querySelectorAll(".page-toc-link");
  links.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.tocId === id);
  });
}

function resetPageToc() {
  if (state.tocScrollHandler) {
    window.removeEventListener("scroll", state.tocScrollHandler);
    state.tocScrollHandler = null;
  }
}

function setupPageToc() {
  resetPageToc();
  const headings = [...els.content.querySelectorAll(".markdown h2[id], .markdown h3[id], .markdown h4[id]")];
  if (!headings.length) return;

  let frame = 0;
  const updateActive = () => {
    frame = 0;
    const line = scrollOffset() + 8;
    const active = headings.reduce((current, heading) => {
      return heading.getBoundingClientRect().top <= line ? heading : current;
    }, headings[0]);
    setActiveTocItem(active.id);
  };
  state.tocScrollHandler = () => {
    if (frame) return;
    frame = requestAnimationFrame(updateActive);
  };
  updateActive();
  window.addEventListener("scroll", state.tocScrollHandler, { passive: true });
}

function renderPage(page) {
  state.route = page.slug;
  state.currentPageSlug = page.slug;
  expandFolderPath(page.folder);
  els.content.className = `content ${pageTocItems(page.body).length ? "has-toc" : ""}`;
  els.breadcrumbs.outerHTML = renderBreadcrumbs(page);
  els.breadcrumbs = document.querySelector("#breadcrumbs");
  els.pageMeta.innerHTML = renderSourceMeta(page);
  setDocumentTitle(page.title);
  els.content.innerHTML = `<div class="doc-layout">
    <article class="doc-article">
      <h1 class="doc-title">${escapeHtml(page.title)}</h1>
      ${page.description ? `<p class="doc-description">${escapeHtml(page.description)}</p>` : ""}
      <div class="markdown">${renderMarkdown(page.body)}</div>
      ${renderBacklinks(page)}
    </article>
    ${renderPageToc(page)}
  </div>`;
  renderTree();
  setupPageToc();
}

function hasVisibleGroupContent(group, hideUndated) {
  return (
    group.features.some((feature) => isFeatureVisible(feature, hideUndated)) ||
    group.children.some((child) => hasVisibleGroupContent(child, hideUndated))
  );
}

function isFeatureVisible(feature, hideUndated) {
  return !hideUndated || featureItems(feature).some((item) => item.start && item.end);
}

function visibleFeatureItems(feature) {
  return featureItems(feature).filter((item) => !state.hideUndatedRoadmap || (item.start && item.end));
}

function roadmapStatusClass(status) {
  return `prm-bar-${String(status || "todo").replace(/[^a-z0-9-]/g, "-")}`;
}

function renderRoadmapGroup(group, timeline, depth = 0) {
  if (!hasVisibleGroupContent(group, state.hideUndatedRoadmap)) return "";

  const isCollapsed = state.collapsedRoadmapGroups.has(group.path);
  const features = isCollapsed
    ? ""
    : group.features
        .filter((feature) => isFeatureVisible(feature, state.hideUndatedRoadmap))
        .map((feature) => renderRoadmapFeature(feature, timeline, depth + 1))
        .join("");
  const children = isCollapsed ? "" : group.children.map((child) => renderRoadmapGroup(child, timeline, depth + 1)).join("");

  return `<section class="prm-group ${isCollapsed ? "is-collapsed" : ""}" style="--prm-depth:${depth}">
    <button class="prm-group-header" type="button" data-roadmap-group="${escapeHtml(group.path)}" aria-expanded="${
      isCollapsed ? "false" : "true"
    }">
      <span class="prm-group-toggle" aria-hidden="true">${icon(isCollapsed ? "chevron-right" : "chevron-down")}</span>
      <span class="prm-group-name">${escapeHtml(group.title || group.name)}</span>
    </button>
    ${features}
    ${children}
  </section>`;
}

function renderRoadmapFeature(feature, timeline, depth) {
  const items = visibleFeatureItems(feature);
  if (!items.length) return "";

  const bars = items
    .map((item) => {
      if (!item.start || !item.end) {
        const title = item.kind === "scope" ? `${feature.title}: ${item.title}` : feature.title;
        return `<a class="prm-no-date" href="${pageHref(feature.slug)}" style="--prm-depth:${depth}">${escapeHtml(title)}</a>`;
      }

      const left = clamp(percentBetween(item.start, timeline.start, timeline.totalMs), 0, 100);
      const right = clamp(percentBetween(item.end, timeline.start, timeline.totalMs), 0, 100);
      const width = Math.max(1.5, right - left);
      const fullTitle = item.kind === "scope" ? `${feature.title}: ${item.title}` : feature.title;
      return `<a class="prm-bar ${roadmapStatusClass(item.status)}" href="${pageHref(feature.slug)}" data-full-title="${escapeHtml(
        fullTitle,
      )}" title="${escapeHtml(`${fullTitle}: ${formatDate(item.start)} - ${formatDate(item.end)}`)}" style="left:${left}%;width:${width}%">
        <span class="prm-bar-title">${escapeHtml(item.kind === "scope" ? item.title : feature.title)}</span>
      </a>`;
    })
    .join("");

  return `<div class="prm-row" style="--prm-depth:${depth}">
    <div class="prm-lane">${bars}</div>
  </div>`;
}

function renderRoadmapTimeline(model) {
  const items = visibleRoadmapItems(model.items);
  const timeline = buildTimeline(items, state.roadmapScale);
  const groups = model.root.children.map((group) => renderRoadmapGroup(group, timeline)).join("");
  const unplanned = state.hideUndatedRoadmap ? "" : renderUnplanned(model.undated);

  return `<div class="prm-scroll">
    <div class="prm-timeline" style="--prm-timeline-width:${timeline.width}px">
      <div class="prm-scale">
        <div class="prm-ticks">
          ${timeline.ticks
            .map(
              (tick) =>
                `<div class="prm-tick" style="left:${tick.left}%;width:${tick.width}%">${escapeHtml(tick.label)}</div>`,
            )
            .join("")}
        </div>
      </div>
      <div class="prm-tree">${groups || `<div class="prm-empty">No roadmap items yet.</div>`}</div>
    </div>
    ${unplanned}
  </div>`;
}

function renderUnplanned(items) {
  if (!items.length) return "";
  return `<section class="prm-unplanned">
    <div class="prm-section-title">Unplanned · ${items.length}</div>
    <div class="prm-unplanned-list">
      ${items
        .map(
          (item) => `<a class="prm-unplanned-item" href="${pageHref(item.slug)}">
            <span class="prm-unplanned-title">${escapeHtml(item.title)}</span>
            <span class="prm-unplanned-path">${escapeHtml(item.parentTitle || item.path)}</span>
          </a>`,
        )
        .join("")}
    </div>
  </section>`;
}

function visibleRoadmapItems(items) {
  return items.filter((item) => !state.hideUndatedRoadmap || (item.start && item.end));
}

function renderRoadmapBoard(model) {
  return `<div class="prm-scroll">
    <div class="prm-board">
      ${STATUS_OPTIONS.map(([status, label]) => renderBoardColumn(status, label, visibleRoadmapItems(model.items))).join("")}
    </div>
  </div>`;
}

function renderBoardColumn(status, label, items) {
  const isCollapsed = state.collapsedBoardColumns.has(status);
  const cards = items.filter((item) => item.status === status);
  return `<section class="prm-board-column prm-board-column-${status} ${isCollapsed ? "is-collapsed" : ""}">
    <button class="prm-board-column-header" type="button" data-board-column="${status}" aria-expanded="${
      isCollapsed ? "false" : "true"
    }">
      <span class="prm-board-column-title">${escapeHtml(label)}</span>
      <span class="prm-board-count">${cards.length}</span>
    </button>
    <div class="prm-board-list">
      ${isCollapsed ? "" : cards.map(renderBoardCard).join("")}
    </div>
  </section>`;
}

function renderBoardCard(item) {
  return `<a class="prm-board-card prm-board-card-${escapeHtml(item.status)}" href="${pageHref(item.slug)}">
    <span class="prm-board-card-title">${escapeHtml(item.title)}</span>
    ${item.parentTitle ? `<span class="prm-board-card-parent">${escapeHtml(item.parentTitle)}</span>` : ""}
    ${
      item.start || item.end
        ? `<span class="prm-board-card-dates">${escapeHtml(formatDate(item.start) || "No start")} - ${escapeHtml(
            formatDate(item.end) || "No end",
          )}</span>`
        : ""
    }
  </a>`;
}

function renderRoadmap() {
  resetPageToc();
  state.route = "__roadmap";
  state.currentPageSlug = "roadmap";
  const model = buildRoadmapModel(state.data, state.data.roadmap || {});
  els.content.className = "content roadmap-content";
  els.breadcrumbs.textContent = "Plugin";
  els.pageMeta.textContent = `${model.featureCount} features · ${model.itemCount} items`;
  setDocumentTitle("Roadmap");
  els.content.innerHTML = `<section class="roadmap-view">
    <header class="prm-header">
      <div class="prm-brand">
        <div class="prm-brand-text">
          <h1 class="prm-title">Roadmap</h1>
          <div class="prm-subtitle">${model.featureCount} features · ${model.groupCount} groups · ${model.itemCount} items</div>
        </div>
        <div class="prm-view-toggle" role="radiogroup" aria-label="View mode">
          <button class="prm-view-toggle-button ${state.roadmapMode === "timeline" ? "is-active" : ""}" type="button" data-mode="timeline">Timeline</button>
          <button class="prm-view-toggle-button ${state.roadmapMode === "board" ? "is-active" : ""}" type="button" data-mode="board">Board</button>
        </div>
      </div>
      <div class="prm-actions">
        <label class="prm-toggle">
          <input type="checkbox" id="hideUndatedRoadmap" ${state.hideUndatedRoadmap ? "checked" : ""} />
          <span>Hide undated</span>
        </label>
        ${
          state.roadmapMode === "timeline"
            ? `<label class="prm-select-wrap">
                <select id="roadmapScale" class="prm-scale-select" aria-label="Timeline scale">
                  ${Object.entries(TIMELINE_SCALES)
                    .map(
                      ([value, config]) =>
                        `<option value="${value}" ${state.roadmapScale === value ? "selected" : ""}>${config.label}</option>`,
                    )
                    .join("")}
                </select>
              </label>
              <button class="prm-icon-button" type="button" data-roadmap-action="expand" title="Expand all" aria-label="Expand all">${icon("arrow-autofit-height")}</button>
              <button class="prm-icon-button" type="button" data-roadmap-action="collapse" title="Collapse all" aria-label="Collapse all">${icon("fold")}</button>`
            : `<button class="prm-icon-button" type="button" data-board-action="expand" title="Expand all" aria-label="Expand all">${icon("arrow-autofit-width")}</button>
              <button class="prm-icon-button" type="button" data-board-action="collapse" title="Collapse all" aria-label="Collapse all">${icon("fold")}</button>`
        }
      </div>
    </header>
    ${state.roadmapMode === "timeline" ? renderRoadmapTimeline(model) : renderRoadmapBoard(model)}
  </section>`;
  els.content.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.roadmapMode = button.dataset.mode;
      renderRoadmap();
    });
  });
  els.content.querySelector("#hideUndatedRoadmap")?.addEventListener("change", (event) => {
    state.hideUndatedRoadmap = event.target.checked;
    renderRoadmap();
  });
  els.content.querySelector("#roadmapScale")?.addEventListener("change", (event) => {
    state.roadmapScale = event.target.value;
    renderRoadmap();
  });
  els.content.querySelectorAll("[data-roadmap-group]").forEach((button) => {
    button.addEventListener("click", () => {
      const path = button.dataset.roadmapGroup;
      if (state.collapsedRoadmapGroups.has(path)) state.collapsedRoadmapGroups.delete(path);
      else state.collapsedRoadmapGroups.add(path);
      renderRoadmap();
    });
  });
  els.content.querySelectorAll("[data-board-column]").forEach((button) => {
    button.addEventListener("click", () => {
      const status = button.dataset.boardColumn;
      if (state.collapsedBoardColumns.has(status)) state.collapsedBoardColumns.delete(status);
      else state.collapsedBoardColumns.add(status);
      renderRoadmap();
    });
  });
  els.content.querySelector("[data-roadmap-action='expand']")?.addEventListener("click", () => {
    state.collapsedRoadmapGroups.clear();
    renderRoadmap();
  });
  els.content.querySelector("[data-roadmap-action='collapse']")?.addEventListener("click", () => {
    state.collapsedRoadmapGroups = new Set(collectRoadmapGroupPaths(model.root));
    renderRoadmap();
  });
  els.content.querySelector("[data-board-action='expand']")?.addEventListener("click", () => {
    state.collapsedBoardColumns.clear();
    renderRoadmap();
  });
  els.content.querySelector("[data-board-action='collapse']")?.addEventListener("click", () => {
    state.collapsedBoardColumns = new Set(STATUS_OPTIONS.map(([status]) => status));
    renderRoadmap();
  });
  renderTree();
}

async function refreshDocs() {
  setRefreshState("Refreshing", true);

  if (!state.auth?.authenticated || state.auth.isAdmin) {
    try {
      const rebuildResponse = await fetch("/__rebuild", { method: "POST" });
      if (!rebuildResponse.ok) {
        throw new Error("Rebuild endpoint is unavailable");
      }
    } catch {
      // Static hosting and non-admin sessions cannot rebuild. Still reload the latest published index.
    }
  }

  try {
    state.data = await loadVaultIndex();
    state.hideUndatedRoadmap = Boolean(state.data.roadmap?.hideUndated);
    state.collapsedFolders = new Set(collectFolderPaths(state.data.tree));
    renderTree();
    renderRoute();
    setRefreshState("Refreshed", true);
    window.setTimeout(() => setRefreshState("Refresh", false), 900);
  } catch (error) {
    setRefreshState("Failed", true);
    els.content.insertAdjacentHTML(
      "afterbegin",
      `<div class="refresh-error">Could not refresh docs: ${escapeHtml(error.message)}</div>`,
    );
    window.setTimeout(() => setRefreshState("Refresh", false), 1400);
  }
}

function collectRoadmapGroupPaths(group, paths = []) {
  for (const child of group.children) {
    paths.push(child.path);
    collectRoadmapGroupPaths(child, paths);
  }
  return paths;
}

function renderSettingsForm(config, message = "") {
  const projectTitle = config.app?.title || appTitle();
  const sourceType = config.source?.type || "local";
  const localPath = config.source?.local?.path || "docs-sample";
  const github = config.source?.github || {};
  const roadmap = config.roadmap || {};
  const configWritable = config.deployment?.configWritable !== false;
  const disabledAttr = configWritable ? "" : "disabled";
  const deploymentMode = config.deployment?.mode || "node";
  els.content.className = "content settings-content";
  els.breadcrumbs.textContent = "Admin";
  els.pageMeta.textContent = configWritable ? "docs-viewer.config.json" : "environment variables";
  setDocumentTitle("Settings");
  els.content.innerHTML = `<section class="settings-panel">
    <h1 class="doc-title">Settings</h1>
    <p class="doc-description">Configure the docs source and folders ignored during indexing.</p>
    ${message ? `<div class="settings-message">${escapeHtml(message)}</div>` : ""}
    ${
      configWritable
        ? ""
        : `<div class="settings-message">This ${escapeHtml(deploymentMode)} deployment is configured through Vercel environment variables. Edit env values in Vercel and redeploy.</div>`
    }
    <form id="settingsForm" class="settings-form">
      <label class="settings-field">
        <span>Project title</span>
        <input name="projectTitle" value="${escapeHtml(projectTitle)}" placeholder="Docs Viewer" ${disabledAttr} />
      </label>
      <fieldset>
        <legend>Source</legend>
        <label class="settings-radio">
          <input type="radio" name="sourceType" value="local" ${sourceType === "local" ? "checked" : ""} ${disabledAttr} />
          <span>Local folder</span>
        </label>
        <label class="settings-radio">
          <input type="radio" name="sourceType" value="github" ${sourceType === "github" ? "checked" : ""} ${disabledAttr} />
          <span>GitHub repository</span>
        </label>
      </fieldset>
      <label class="settings-field">
        <span>Local path</span>
        <input name="localPath" value="${escapeHtml(localPath)}" placeholder="docs-sample" ${disabledAttr} />
      </label>
      <div class="settings-grid">
        <label class="settings-field">
          <span>GitHub owner</span>
          <input name="githubOwner" value="${escapeHtml(github.owner || "")}" placeholder="owner" ${disabledAttr} />
        </label>
        <label class="settings-field">
          <span>Repository</span>
          <input name="githubRepo" value="${escapeHtml(github.repo || "")}" placeholder="repo" ${disabledAttr} />
        </label>
        <label class="settings-field">
          <span>Branch</span>
          <input name="githubBranch" value="${escapeHtml(github.branch || "main")}" placeholder="main" ${disabledAttr} />
        </label>
        <label class="settings-field">
          <span>Docs path in repo</span>
          <input name="githubPath" value="${escapeHtml(github.path || "")}" placeholder="Repository root" ${disabledAttr} />
        </label>
      </div>
      <p class="settings-note">Leave <code>Docs path in repo</code> empty to index markdown from the repository root.</p>
      <p class="settings-note">Private GitHub repositories use server-side env token: <code>DOCS_VIEWER_GITHUB_TOKEN</code> or <code>GITHUB_TOKEN</code>. Token configured: ${
        config.githubTokenConfigured ? "yes" : "no"
      }.</p>
      <p class="settings-note">Auth wall: ${
        config.auth?.enabled ? `enabled via ${(config.auth.providers || []).join(", ") || "no providers"}` : "disabled"
      }. Allowed emails configured: ${Number(config.auth?.allowedEmailsConfigured || 0)}. Allowed domains configured: ${Number(
        config.auth?.allowedDomainsConfigured || 0,
      )}. Admin emails configured: ${Number(config.auth?.adminEmailsConfigured || 0)}.</p>
      <label class="settings-field">
        <span>Ignored folders</span>
        <textarea name="ignoredFolders" rows="7" ${disabledAttr}>${escapeHtml((config.ignoredFolders || []).join("\n"))}</textarea>
      </label>
      <fieldset>
        <legend>Roadmap</legend>
        <label class="settings-field">
          <span>Included folders</span>
          <textarea name="roadmapIncludedFolders" rows="4" ${disabledAttr}>${escapeHtml((roadmap.includedFolders || []).join("\n"))}</textarea>
        </label>
        <label class="settings-field">
          <span>Excluded folders</span>
          <textarea name="roadmapExcludedFolders" rows="4" ${disabledAttr}>${escapeHtml((roadmap.excludedFolders || []).join("\n"))}</textarea>
        </label>
        <p class="settings-note settings-note-wide">Included folders are an allowlist. Leave them empty to scan the full vault. Excluded folders are then applied as a denylist, which is useful for skipping archive or draft subfolders inside an included area.</p>
        <label class="settings-radio">
          <input type="checkbox" name="roadmapHideUndated" value="true" ${roadmap.hideUndated ? "checked" : ""} ${disabledAttr} />
          <span>Hide undated roadmap items by default</span>
        </label>
      </fieldset>
      <div class="settings-actions">
        <button class="refresh-docs" type="submit" ${disabledAttr}>Save and rebuild</button>
      </div>
    </form>
  </section>`;

  els.content.querySelector("#settingsForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!configWritable) return;
    const form = new FormData(event.currentTarget);
    const nextConfig = {
      app: {
        title: String(form.get("projectTitle") || "Docs Viewer").trim() || "Docs Viewer",
      },
      source: {
        type: form.get("sourceType"),
        local: { path: String(form.get("localPath") || "docs-sample").trim() },
        github: {
          owner: String(form.get("githubOwner") || "").trim(),
          repo: String(form.get("githubRepo") || "").trim(),
          branch: String(form.get("githubBranch") || "main").trim(),
          path: String(form.get("githubPath") || "").trim(),
        },
      },
      ignoredFolders: String(form.get("ignoredFolders") || "")
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
      roadmap: {
        includedFolders: String(form.get("roadmapIncludedFolders") || "")
          .split(/\r?\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
        excludedFolders: String(form.get("roadmapExcludedFolders") || "")
          .split(/\r?\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
        hideUndated: form.get("roadmapHideUndated") === "true",
      },
    };

    try {
      await saveViewerConfig(nextConfig);
      await fetch("/__rebuild", { method: "POST" });
      state.data = await loadVaultIndex();
      state.hideUndatedRoadmap = Boolean(state.data.roadmap?.hideUndated);
      state.collapsedFolders = new Set(collectFolderPaths(state.data.tree));
      setBrandTitle();
      applyFavicon();
      renderTree();
      renderSettingsForm({ ...nextConfig, githubTokenConfigured: config.githubTokenConfigured }, "Settings saved and index rebuilt.");
    } catch (error) {
      renderSettingsForm(config, error.message);
    }
  });
}

async function renderSettings() {
  if (!canAccessSettings(state.auth)) {
    navigateTo("/", true);
    return;
  }
  resetPageToc();
  state.route = "__settings";
  state.currentPageSlug = "settings";
  renderTree();
  try {
    renderSettingsForm(await loadViewerConfig());
  } catch (error) {
  els.content.className = "content settings-content";
  els.breadcrumbs.textContent = "Admin";
  els.pageMeta.textContent = "settings unavailable";
  els.content.innerHTML = `<section class="settings-panel">
    <h1 class="doc-title">Settings</h1>
    <div class="refresh-error">${escapeHtml(error.message)}</div>
      <p class="doc-description">Admin access is required to edit settings.</p>
    </section>`;
  }
}

function renderRoute() {
  const previousPageSlug = state.currentPageSlug;
  const route = currentRoute();
  setMobileNavOpen(false);
  if (location.hash.startsWith("#/")) {
    const cleanRoute = route ? pageHref(route) : "/";
    history.replaceState(null, "", cleanRoute);
  }
  if (route === "roadmap") {
    renderRoadmap();
    if (previousPageSlug && previousPageSlug !== state.currentPageSlug) scrollRouteToTop();
    return;
  }

  if (route === "settings") {
    renderSettings();
    if (previousPageSlug && previousPageSlug !== state.currentPageSlug) scrollRouteToTop();
    return;
  }

  const page = findPage(route);
  if (page) {
    if (route && route !== page.slug) {
      const hash = routeHash();
      history.replaceState(null, "", `${pageHref(page.slug)}${hash ? `#${encodeURIComponent(hash)}` : ""}`);
    }
    renderPage(page);
    if (!scrollToHash() && previousPageSlug !== state.currentPageSlug) scrollRouteToTop();
    return;
  }

  els.content.innerHTML = `<div class="empty-state">Page not found.</div>`;
  if (previousPageSlug) scrollRouteToTop();
}

async function init() {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  state.data = await loadVaultIndex();
  setBrandTitle();
  applyFavicon();
  state.hideUndatedRoadmap = Boolean(state.data.roadmap?.hideUndated);
  state.auth = await loadAuthStatus();
  renderAuthStatus(state.auth);
  applyAdminUi(state.auth);
  state.collapsedFolders = new Set(collectFolderPaths(state.data.tree));
  els.searchInput.addEventListener("input", () => {
    state.query = els.searchInput.value;
    renderTree();
  });
  els.searchToggle?.addEventListener("click", () => {
    const search = document.querySelector(".search");
    setSearchOpen(!search?.classList.contains("is-open"));
  });
  els.expandTree?.addEventListener("click", () => {
    state.collapsedFolders.clear();
    renderTree();
  });
  els.collapseTree?.addEventListener("click", () => {
    state.collapsedFolders = new Set(collectFolderPaths(state.data.tree));
    const page = currentTreePage();
    if (page) expandFolderPath(page.folder);
    renderTree({ scrollActive: false });
  });
  els.mobileMenuToggle?.addEventListener("click", () => {
    setMobileNavOpen(!state.mobileNavOpen);
  });
  els.roadmapLink.addEventListener("click", () => {
    navigateTo("/roadmap");
  });
  els.settingsLink?.addEventListener("click", () => {
    navigateTo("/settings");
  });
  els.refreshDocs?.addEventListener("click", refreshDocs);
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || link.target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin) return;
    if (url.pathname.startsWith("/__auth/")) return;
    event.preventDefault();
    if (samePageHashLink(url)) {
      history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
      scrollToHash({ behavior: "smooth" });
      return;
    }
    navigateTo(`${url.pathname}${url.search}${url.hash}`);
  });
  window.addEventListener("popstate", renderRoute);
  renderRoute();
}

init().catch((error) => {
  els.content.innerHTML = `<div class="empty-state">Viewer failed to start: ${escapeHtml(error.message)}</div>`;
});
