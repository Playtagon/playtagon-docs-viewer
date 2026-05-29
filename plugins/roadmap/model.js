export const STATUS_OPTIONS = [
  ["backlog", "Backlog"],
  ["todo", "Todo"],
  ["planned", "Planned"],
  ["in-progress", "In progress"],
  ["blocked", "Blocked"],
  ["done", "Done"],
];

export const TIMELINE_SCALES = {
  week: { label: "Week" },
  twoWeeks: { label: "2 weeks" },
  month: { label: "Month" },
  quarter: { label: "Quarter" },
};

const DATE_FIELDS_START = ["roadmap_start", "start", "starts", "start_date", "date_start", "target_start"];
const DATE_FIELDS_END = ["roadmap_end", "end", "ends", "end_date", "date_end", "target_end", "due"];

const DEFAULT_SCALE = "month";

function readDate(item, fields) {
  for (const field of fields) {
    if (item?.[field]) return parseDateField(item[field]);
  }
  return null;
}

export function normalizeStatus(value) {
  const normalized = slug(value || "todo");
  return STATUS_OPTIONS.some(([status]) => status === normalized) ? normalized : "todo";
}

function isExcludedPage(page, excludedFolders) {
  return excludedFolders.some((folder) => page.path === `${folder}.md` || page.path.startsWith(`${folder}/`));
}

function isIncludedPage(page, includedFolders) {
  if (!includedFolders.length) return true;
  return includedFolders.some((folder) => page.path === `${folder}.md` || page.path.startsWith(`${folder}/`));
}

function normalizeFolderList(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item || "").replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);
}

function createGroup(path, name, parent) {
  return {
    path,
    name,
    title: displayGroupName(name),
    parent,
    children: [],
    features: [],
  };
}

function ensureGroup(groupsByPath, root, folderPath) {
  if (!folderPath) return root;
  if (groupsByPath.has(folderPath)) return groupsByPath.get(folderPath);

  const parts = folderPath.split("/");
  let current = root;
  let currentPath = "";

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    let next = groupsByPath.get(currentPath);
    if (!next) {
      next = createGroup(currentPath, part, current);
      groupsByPath.set(currentPath, next);
      current.children.push(next);
    }
    current = next;
  }

  return current;
}

function normalizeFeature(page) {
  const frontmatter = page.frontmatter || {};
  const feature = {
    id: page.slug,
    kind: "feature",
    title: page.title,
    parentTitle: "",
    slug: page.slug,
    path: page.path,
    folder: page.folder || "Docs",
    status: normalizeStatus(frontmatter.status),
    start: readDate(frontmatter, DATE_FIELDS_START),
    end: readDate(frontmatter, DATE_FIELDS_END),
    scopes: [],
  };

  const scopes = Array.isArray(frontmatter.scopes) ? frontmatter.scopes : [];
  feature.scopes = scopes.map((scope, index) => normalizeScope(feature, scope, index));
  return feature;
}

function normalizeScope(feature, scope, index) {
  return {
    id: `${feature.slug}#scope-${index}`,
    kind: "scope",
    index,
    title: scope.title || scope.name || `${feature.title} scope ${index + 1}`,
    parentTitle: feature.title,
    slug: feature.slug,
    path: feature.path,
    folder: feature.folder,
    status: normalizeStatus(scope.status || feature.status),
    start: readDate(scope, DATE_FIELDS_START) || feature.start,
    end: readDate(scope, DATE_FIELDS_END) || feature.end,
  };
}

export function buildRoadmapModel(vaultIndex, options = {}) {
  const includedFolders = normalizeFolderList(options.includedFolders || vaultIndex.roadmap?.includedFolders);
  const excludedFolders = normalizeFolderList(options.excludedFolders || vaultIndex.roadmap?.excludedFolders);
  const root = createGroup("", "Vault", null);
  const groupsByPath = new Map([["", root]]);
  const features = [];
  const items = [];

  for (const page of vaultIndex.pages || []) {
    if (!isIncludedPage(page, includedFolders)) continue;
    if (isExcludedPage(page, excludedFolders)) continue;

    const group = ensureGroup(groupsByPath, root, page.folder || "");
    if (page.isIndex) {
      group.title = page.frontmatter?.title || page.title || group.title;
      continue;
    }

    const feature = normalizeFeature(page);
    group.features.push(feature);
    features.push(feature);
    items.push(...featureItems(feature));
  }

  pruneEmptyGroups(root);
  sortRoadmapTree(root);

  return {
    root,
    features,
    items,
    dated: items.filter((item) => item.start && item.end),
    undated: items.filter((item) => !item.start || !item.end),
    featureCount: features.length,
    groupCount: countGroups(root),
    itemCount: items.length,
  };
}

export function featureItems(feature) {
  return feature.scopes.length ? feature.scopes : [feature];
}

export function buildTimeline(items, scale = DEFAULT_SCALE) {
  const dated = items.filter((item) => item.start && item.end);
  const today = new Date();
  const normalizedScale = TIMELINE_SCALES[scale] ? scale : DEFAULT_SCALE;
  let start = alignStart(new Date(today.getFullYear(), today.getMonth(), 1), normalizedScale);
  let end = alignEnd(new Date(today.getFullYear(), today.getMonth() + 3, 0), normalizedScale);

  if (dated.length) {
    start = alignStart(minDate(dated.map((item) => item.start)), normalizedScale);
    end = alignEnd(maxDate(dated.map((item) => item.end)), normalizedScale);
  }

  const totalMs = Math.max(1, end.getTime() - start.getTime());
  const ticks = [];
  let cursor = new Date(start);

  while (cursor <= end) {
    const next = nextTick(cursor, normalizedScale);
    const tickEnd = new Date(Math.min(next.getTime() - 1, end.getTime()));
    const left = percentBetween(cursor, start, totalMs);
    const width = Math.max(2, percentBetween(tickEnd, start, totalMs) - left);
    ticks.push({ label: formatTickLabel(cursor, normalizedScale), left, width });
    cursor = next;
  }

  return { start, end, totalMs, ticks, scale: normalizedScale, width: timelineWidth(ticks.length, normalizedScale) };
}

export function formatDate(date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function percentBetween(date, start, totalMs) {
  return ((date.getTime() - start.getTime()) / totalMs) * 100;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseDateField(value) {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  const dateOnly = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function pruneEmptyGroups(group) {
  group.children = group.children.filter((child) => {
    pruneEmptyGroups(child);
    return child.children.length || child.features.length;
  });
}

function sortRoadmapTree(group) {
  group.children.sort(compareGroups);
  group.features.sort(compareFeatures);
  for (const child of group.children) sortRoadmapTree(child);
}

function compareGroups(a, b) {
  const aNumber = leadingNumber(a.name);
  const bNumber = leadingNumber(b.name);
  if (aNumber !== null && bNumber !== null && aNumber !== bNumber) return aNumber - bNumber;
  if (aNumber !== null && bNumber === null) return -1;
  if (aNumber === null && bNumber !== null) return 1;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

function compareFeatures(a, b) {
  const aStart = earliestFeatureDate(a);
  const bStart = earliestFeatureDate(b);
  if (aStart && bStart && aStart.getTime() !== bStart.getTime()) return aStart.getTime() - bStart.getTime();
  if (aStart && !bStart) return -1;
  if (!aStart && bStart) return 1;
  return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" });
}

function earliestFeatureDate(feature) {
  const dates = featureItems(feature).map((item) => item.start).filter(Boolean);
  return dates.length ? minDate(dates) : null;
}

function countGroups(group) {
  return group.children.reduce((count, child) => count + 1 + countGroups(child), 0);
}

function leadingNumber(value) {
  const match = String(value || "").match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function displayGroupName(value) {
  return String(value || "").trim().replace(/^\d+\s*[-_. ]\s*/, "");
}

function alignStart(date, scale) {
  if (scale === "month") return new Date(date.getFullYear(), date.getMonth(), 1);
  if (scale === "quarter") return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
  return startOfWeek(date);
}

function alignEnd(date, scale) {
  if (scale === "month") return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  if (scale === "quarter") {
    const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
    return new Date(date.getFullYear(), quarterStartMonth + 3, 0);
  }
  const weekStart = startOfWeek(date);
  return addDays(weekStart, scale === "twoWeeks" ? 13 : 6);
}

function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}

function nextTick(date, scale) {
  if (scale === "month") return new Date(date.getFullYear(), date.getMonth() + 1, 1);
  if (scale === "quarter") return new Date(date.getFullYear(), date.getMonth() + 3, 1);
  return addDays(date, scale === "twoWeeks" ? 14 : 7);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatTickLabel(date, scale) {
  if (scale === "quarter") return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
  if (scale === "month") return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  const end = addDays(date, scale === "twoWeeks" ? 13 : 6);
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

function timelineWidth(tickCount, scale) {
  const columnWidth = { week: 150, twoWeeks: 170, month: 190, quarter: 220 }[scale] || 160;
  return Math.max(980, tickCount * columnWidth);
}

function minDate(dates) {
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

function maxDate(dates) {
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function slug(value) {
  return (
    String(value || "unknown")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "unknown"
  );
}
