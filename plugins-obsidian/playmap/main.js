const { ItemView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, setIcon } = require("obsidian");

const VIEW_TYPE = "playmap-view";
const DATE_FIELD_START = ["roadmap_start", "start", "starts", "start_date", "date_start", "target_start"];
const DATE_FIELD_END = ["roadmap_end", "end", "ends", "end_date", "date_end", "target_end", "due"];
const DEFAULT_SETTINGS = {
  includedFolders: ["docs-sample/04-Roadmap-Sample"],
  excludedFolders: [],
  timelineScale: "week",
  viewMode: "timeline",
  hideUndated: false,
};
const STATUS_OPTIONS = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "planned", label: "Planned" },
  { value: "in-progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];
const TIMELINE_SCALES = {
  week: { label: "Week" },
  twoWeeks: { label: "2 weeks" },
  month: { label: "Month" },
  quarter: { label: "Quarter" },
};
const VIEW_MODES = {
  timeline: { label: "Timeline" },
  board: { label: "Board" },
};

class PlayMapPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.suppressRefreshUntil = 0;

    this.registerView(VIEW_TYPE, (leaf) => new RoadmapView(leaf, this));
    this.addSettingTab(new RoadmapSettingTab(this.app, this));

    this.addRibbonIcon("milestone", "Open Play Map", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-playmap",
      name: "Open Play Map",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "add-scope-to-current-note",
      name: "Add scope to current note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") {
          return false;
        }

        if (!checking) {
          this.addScopeToFile(file);
        }

        return true;
      },
    });

    this.addCommand({
      id: "edit-scopes-in-current-note",
      name: "Edit scopes in current note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") {
          return false;
        }

        if (!checking) {
          new ScopeEditorModal(this, file).open();
        }

        return true;
      },
    });

    this.registerEvent(this.app.vault.on("create", () => this.refreshViews()));
    this.registerEvent(this.app.vault.on("delete", () => this.refreshViews()));
    this.registerEvent(this.app.vault.on("rename", () => this.refreshViews()));
    this.registerEvent(this.app.metadataCache.on("changed", () => this.refreshViews()));
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async activateView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    const leaf = leaves[0] || this.app.workspace.getRightLeaf(false);

    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  refreshViews() {
    if (Date.now() < this.suppressRefreshUntil) {
      return;
    }

    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof RoadmapView) {
        leaf.view.scheduleRender();
      }
    }
  }

  suppressAutoRefresh(ms = 1200) {
    this.suppressRefreshUntil = Math.max(this.suppressRefreshUntil || 0, Date.now() + ms);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.includedFolders = normalizeFolderList(this.settings.includedFolders);
    this.settings.excludedFolders = normalizeFolderList(this.settings.excludedFolders);
    this.settings.timelineScale = TIMELINE_SCALES[this.settings.timelineScale]
      ? this.settings.timelineScale
      : DEFAULT_SETTINGS.timelineScale;
    this.settings.viewMode = VIEW_MODES[this.settings.viewMode] ? this.settings.viewMode : DEFAULT_SETTINGS.viewMode;
    this.settings.hideUndated = Boolean(this.settings.hideUndated);
  }

  async saveSettings() {
    this.settings.includedFolders = normalizeFolderList(this.settings.includedFolders);
    this.settings.excludedFolders = normalizeFolderList(this.settings.excludedFolders);
    await this.saveData(this.settings);
    this.refreshViews();
  }

  async addScopeToFile(file) {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = addDays(start, 14);

    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      if (!Array.isArray(frontmatter.scopes)) {
        frontmatter.scopes = [];
      }

      frontmatter.scopes.push({
        title: `Scope ${frontmatter.scopes.length + 1}`,
        status: "todo",
        start: formatDate(start),
        end: formatDate(end),
      });
    });

    new Notice(`Scope added to ${file.basename}`);
    this.refreshViews();
  }
}

class RoadmapSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Play Map" });

    new Setting(containerEl)
      .setName("Folders to scan")
      .setDesc("One folder per line or comma-separated. Subfolders are included. Empty means the whole vault.")
      .addTextArea((text) => {
        text
          .setPlaceholder("docs-sample/04-Roadmap-Sample")
          .setValue(this.plugin.settings.includedFolders.join("\n"))
          .onChange(async (value) => {
            this.plugin.settings.includedFolders = normalizeFolderList(value);
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 5;
      });

    new Setting(containerEl)
      .setName("Folders to exclude")
      .setDesc("One folder per line or comma-separated. These paths are skipped even when they are inside scanned folders.")
      .addTextArea((text) => {
        text
          .setPlaceholder("docs-sample/00-Overview")
          .setValue(this.plugin.settings.excludedFolders.join("\n"))
          .onChange(async (value) => {
            this.plugin.settings.excludedFolders = normalizeFolderList(value);
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 5;
      });

    new Setting(containerEl)
      .setName("Default timeline scale")
      .setDesc("The view can still be changed from the roadmap toolbar.")
      .addDropdown((dropdown) => {
        for (const [value, config] of Object.entries(TIMELINE_SCALES)) {
          dropdown.addOption(value, config.label);
        }

        dropdown.setValue(this.plugin.settings.timelineScale).onChange(async (value) => {
          this.plugin.settings.timelineScale = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Hide undated features")
      .setDesc("Only show features that have roadmap_start and roadmap_end.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.hideUndated).onChange(async (value) => {
          this.plugin.settings.hideUndated = value;
          await this.plugin.saveSettings();
        });
      });
  }
}

class ScopeEditorModal extends Modal {
  constructor(plugin, file) {
    super(plugin.app);
    this.plugin = plugin;
    this.file = file;
    this.scopes = [];
  }

  onOpen() {
    const cache = this.app.metadataCache.getFileCache(this.file);
    this.scopes = cloneScopes(cache?.frontmatter?.scopes || []);
    this.render();
  }

  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("prm-scope-modal");

    const header = contentEl.createDiv({ cls: "prm-scope-header" });
    header.createEl("h2", { text: `Scopes: ${this.file.basename}` });
    const close = header.createEl("button", { cls: "prm-scope-close", attr: { "aria-label": "Close" } });
    setIcon(close, "x");
    close.addEventListener("click", () => this.close());

    const body = contentEl.createDiv({ cls: "prm-scope-body" });
    const list = body.createDiv({ cls: "prm-scope-list" });
    if (!this.scopes.length) {
      list.createDiv({ cls: "prm-scope-empty", text: "No scopes yet." });
    }

    this.scopes.forEach((scope, index) => {
      this.renderScopeRow(list, scope, index);
    });

    const actions = contentEl.createDiv({ cls: "prm-scope-actions" });
    const add = actions.createEl("button", { text: "Add scope" });
    add.addEventListener("click", () => {
      const today = new Date();
      this.scopes.push({
        title: `Scope ${this.scopes.length + 1}`,
        status: "todo",
        start: formatDate(today),
        end: formatDate(addDays(today, 14)),
      });
      this.render();
    });

    const save = actions.createEl("button", { text: "Save", cls: "mod-cta" });
    save.addEventListener("click", async () => {
      await this.save();
      this.close();
    });
  }

  renderScopeRow(parent, scope, index) {
    const row = parent.createDiv({ cls: "prm-scope-row" });

    const titleField = createScopeField(row, "Title");
    const title = titleField.createEl("input", { type: "text" });
    title.value = scope.title || "";
    title.addEventListener("input", () => {
      scope.title = title.value;
    });

    const statusField = createScopeField(row, "Status");
    const status = statusField.createEl("select");
    for (const option of STATUS_OPTIONS) {
      status.createEl("option", { value: option.value, text: option.label });
    }
    status.value = normalizeStatusValue(scope.status);
    status.addEventListener("change", () => {
      scope.status = status.value;
    });

    const startField = createScopeField(row, "Start");
    const start = startField.createEl("input", { type: "date" });
    start.value = scope.start || "";
    start.addEventListener("input", () => {
      scope.start = start.value;
    });

    const endField = createScopeField(row, "End");
    const end = endField.createEl("input", { type: "date" });
    end.value = scope.end || "";
    end.addEventListener("input", () => {
      scope.end = end.value;
    });

    const remove = row.createEl("button", { cls: "prm-scope-delete", attr: { "aria-label": "Delete scope" } });
    setIcon(remove, "trash-2");
    remove.addEventListener("click", () => {
      this.scopes.splice(index, 1);
      this.render();
    });
  }

  async save() {
    const scopes = this.scopes
      .map((scope, index) => ({
        title: String(scope.title || `Scope ${index + 1}`).trim(),
        status: normalizeStatusValue(scope.status),
        start: String(scope.start || "").trim(),
        end: String(scope.end || "").trim(),
      }))
      .filter((scope) => scope.title || scope.start || scope.end);

    await this.app.fileManager.processFrontMatter(this.file, (frontmatter) => {
      frontmatter.scopes = scopes;
    });

    new Notice(`Scopes saved: ${this.file.basename}`);
    this.plugin.refreshViews();
  }
}

function createScopeField(parent, label) {
  const field = parent.createDiv({ cls: "prm-scope-field" });
  field.createEl("label", { text: label });
  return field;
}

class RoadmapView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.renderTimer = null;
    this.collapsedGroups = new Set();
    this.collapsedBoardColumns = new Set();
    this.boardStatusOverrides = new Map();
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return "Play Map";
  }

  getIcon() {
    return "milestone";
  }

  async onOpen() {
    this.render();
  }

  async onClose() {
    if (this.renderTimer) {
      window.clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
  }

  scheduleRender() {
    if (this.renderTimer) {
      window.clearTimeout(this.renderTimer);
    }

    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      this.render();
    }, 250);
  }

  getScrollState() {
    const scrollEl = this.contentEl.querySelector(".prm-scroll");
    return scrollEl ? { left: scrollEl.scrollLeft, top: scrollEl.scrollTop } : null;
  }

  restoreScrollState(state) {
    if (!state) {
      return;
    }

    window.requestAnimationFrame(() => {
      const scrollEl = this.contentEl.querySelector(".prm-scroll");
      if (scrollEl) {
        scrollEl.scrollLeft = state.left;
        scrollEl.scrollTop = state.top;
      }
    });
  }

  refreshBoard() {
    const scrollState = this.getScrollState();
    const scrollEl = this.contentEl.querySelector(".prm-scroll");
    if (!scrollEl) {
      this.render();
      return;
    }

    scrollEl.empty();
    const model = buildRoadmapModel(this.plugin.app, this.plugin.settings);
    renderBoard(scrollEl, model, this);
    this.restoreScrollState(scrollState);
  }

  render() {
    const scrollState = this.getScrollState();
    const root = this.contentEl;
    root.empty();
    root.addClass("playmap");

    const model = buildRoadmapModel(this.plugin.app, this.plugin.settings);

    const header = root.createDiv({ cls: "prm-header" });
    const brand = header.createDiv({ cls: "prm-brand" });
    const brandText = brand.createDiv({ cls: "prm-brand-text" });
    brandText.createDiv({ cls: "prm-title", text: "Play Map" });
    brandText.createDiv({ cls: "prm-subtitle", text: `${model.featureCount} features` });

    const viewToggle = brand.createDiv({ cls: "prm-view-toggle", attr: { role: "radiogroup", "aria-label": "View mode" } });
    for (const [value, config] of Object.entries(VIEW_MODES)) {
      const button = viewToggle.createEl("button", {
        cls: `prm-view-toggle-button ${this.plugin.settings.viewMode === value ? "is-active" : ""}`,
        text: config.label,
        attr: { role: "radio", "aria-checked": String(this.plugin.settings.viewMode === value) },
      });
      button.addEventListener("click", async () => {
        this.plugin.settings.viewMode = value;
        await this.plugin.saveSettings();
      });
    }

    const actions = header.createDiv({ cls: "prm-actions" });
    const hideUndatedLabel = actions.createEl("label", { cls: "prm-toggle" });
    const hideUndated = hideUndatedLabel.createEl("input", { type: "checkbox" });
    hideUndated.checked = this.plugin.settings.hideUndated;
    hideUndatedLabel.createSpan({ text: "Hide undated" });
    hideUndated.addEventListener("change", async () => {
      this.plugin.settings.hideUndated = hideUndated.checked;
      await this.plugin.saveSettings();
    });

    if (this.plugin.settings.viewMode === "timeline") {
      const scaleWrap = actions.createDiv({ cls: "prm-select-wrap" });
      const scaleSelect = scaleWrap.createEl("select", { cls: "prm-scale-select", attr: { "aria-label": "Timeline scale" } });
      for (const [value, config] of Object.entries(TIMELINE_SCALES)) {
        scaleSelect.createEl("option", { value, text: config.label });
      }
      scaleSelect.value = this.plugin.settings.timelineScale;
      scaleSelect.addEventListener("change", async () => {
        this.plugin.settings.timelineScale = scaleSelect.value;
        await this.plugin.saveSettings();
      });
      setIcon(scaleWrap.createSpan({ cls: "prm-select-chevron" }), "chevron-down");
    }

    const visibleRootGroups = getVisibleRootGroups(model.root, model.includedFolders);
    const expandAll = actions.createEl("button", { cls: "prm-icon-button", attr: { "aria-label": "Expand all groups" } });
    setIcon(expandAll, "chevrons-up-down");
    expandAll.addEventListener("click", () => {
      if (this.plugin.settings.viewMode === "board") {
        this.collapsedBoardColumns.clear();
        this.refreshBoard();
      } else {
        this.collapsedGroups.clear();
        this.render();
      }
    });

    const collapseAll = actions.createEl("button", { cls: "prm-icon-button", attr: { "aria-label": "Collapse all groups" } });
    setIcon(collapseAll, "chevrons-down-up");
    collapseAll.addEventListener("click", () => {
      if (this.plugin.settings.viewMode === "board") {
        this.collapsedBoardColumns = new Set(STATUS_OPTIONS.map((status) => status.value));
        this.refreshBoard();
      } else {
        this.collapsedGroups = new Set(collectVisibleGroupPaths(visibleRootGroups, this.plugin.settings.hideUndated));
        this.render();
      }
    });

    const refresh = actions.createEl("button", { cls: "prm-icon-button", attr: { "aria-label": "Refresh" } });
    setIcon(refresh, "refresh-cw");
    refresh.addEventListener("click", () => {
      new Notice("Roadmap refreshed");
      this.render();
    });

    if (!model.featureCount) {
      const empty = root.createDiv({ cls: "prm-empty" });
      empty.createDiv({ cls: "prm-empty-title", text: "No feature files found" });
      empty.createDiv({
        cls: "prm-empty-copy",
        text: "Create markdown files inside project folders. Files named like their folder are treated as indexes.",
      });
      return;
    }

    const scrollEl = root.createDiv({ cls: "prm-scroll" });
    if (this.plugin.settings.viewMode === "board") {
      renderBoard(scrollEl, model, this);
      this.restoreScrollState(scrollState);
      return;
    }

    const timeline = buildTimeline(model.visibleFeatures, this.plugin.settings.timelineScale);
    const timelineEl = scrollEl.createDiv({ cls: "prm-timeline" });
    timelineEl.style.setProperty("--prm-timeline-width", `${timeline.width}px`);

    const scale = timelineEl.createDiv({ cls: "prm-scale" });
    const ticksEl = scale.createDiv({ cls: "prm-ticks" });
    for (const tick of timeline.ticks) {
      const tickEl = ticksEl.createDiv({ cls: "prm-tick", text: tick.label });
      tickEl.style.left = `${tick.left}%`;
      tickEl.style.width = `${tick.width}%`;
    }

    const treeEl = timelineEl.createDiv({ cls: "prm-tree" });
    for (const child of visibleRootGroups) {
      renderGroup(treeEl, child, timeline, this, 0);
    }

    if (!this.plugin.settings.hideUndated && model.unplanned.length) {
      const section = scrollEl.createDiv({ cls: "prm-unplanned" });
      section.createDiv({ cls: "prm-section-title", text: "Unplanned" });
      const list = section.createDiv({ cls: "prm-unplanned-list" });
      for (const feature of model.unplanned) {
        renderUnplannedFeature(list, feature, this.plugin.app);
      }
    }

    this.restoreScrollState(scrollState);
  }
}

function buildRoadmapModel(app, settings) {
  const root = createGroup("", "Vault", null);
  const groupsByPath = new Map([["", root]]);
  const features = [];
  const unplanned = [];
  const includedFolders = normalizeFolderList(settings?.includedFolders || DEFAULT_SETTINGS.includedFolders);
  const excludedFolders = normalizeFolderList(settings?.excludedFolders || DEFAULT_SETTINGS.excludedFolders);

  for (const file of app.vault.getMarkdownFiles()) {
    if (!isFileIncluded(file, includedFolders) || isFileExcluded(file, excludedFolders)) {
      continue;
    }

    if (!isRoadmapFeature(file)) {
      const group = ensureGroup(groupsByPath, root, file.parent?.path || "");
      const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter || {};
      group.indexFile = file;
      group.title = stringField(frontmatter.title) || group.name;
      continue;
    }

    const folderPath = file.parent?.path || "";
    const group = ensureGroup(groupsByPath, root, folderPath);
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter || {};
    const feature = normalizeFeature(file, group.path, frontmatter);

    group.features.push(feature);
    features.push(feature);

    if (!feature.start || !feature.end) {
      unplanned.push(feature);
    }
  }

  pruneEmptyGroups(root);
  sortRoadmapTree(root);

  return {
    root,
    features,
    visibleFeatures: timelineItemsForFeatures(features, Boolean(settings?.hideUndated)),
    unplanned,
    featureCount: features.length,
    groupCount: countGroups(root),
    includedFolders,
    excludedFolders,
  };
}

function createGroup(path, name, parent) {
  return {
    path,
    name,
    title: displayGroupName(name),
    indexFile: null,
    parent,
    children: [],
    features: [],
  };
}

function ensureGroup(groupsByPath, root, folderPath) {
  if (!folderPath) {
    return root;
  }

  if (groupsByPath.has(folderPath)) {
    return groupsByPath.get(folderPath);
  }

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

function isRoadmapFeature(file) {
  if (!(file instanceof TFile) || file.extension !== "md") {
    return false;
  }

  if (file.basename.toLowerCase() === "index") {
    return false;
  }

  const folderName = file.parent?.name;
  if (!folderName) {
    return true;
  }

  return normalizeIndexName(file.basename) !== normalizeIndexName(folderName);
}

function normalizeIndexName(value) {
  return String(value || "")
    .trim()
    .replace(/^\d+\s*[-_. ]\s*/, "")
    .toLowerCase();
}

function displayGroupName(value) {
  return String(value || "")
    .trim()
    .replace(/^\d+\s*[-_. ]\s*/, "");
}

function normalizeFeature(file, groupPath, frontmatter) {
  const start = parseDateField(pickField(frontmatter, DATE_FIELD_START));
  const end = parseDateField(pickField(frontmatter, DATE_FIELD_END));

  return {
    kind: "feature",
    file,
    groupPath,
    title: stringField(frontmatter.title) || file.basename,
    status: stringField(frontmatter.status) || "unknown",
    start,
    end,
    owner: stringField(frontmatter.owner),
    linear: normalizeLinear(frontmatter.linear),
    priority: stringField(frontmatter.priority),
    tags: normalizeList(frontmatter.tags || frontmatter.tag),
    scopes: normalizeScopes(frontmatter.scopes),
  };
}

function normalizeScopes(scopes) {
  if (!Array.isArray(scopes)) {
    return [];
  }

  return scopes.map((scope, index) => {
    const start = parseDateField(pickField(scope, DATE_FIELD_START));
    const end = parseDateField(pickField(scope, DATE_FIELD_END));

    return {
      kind: "scope",
      index,
      title: stringField(scope.title || scope.name) || `Scope ${index + 1}`,
      status: stringField(scope.status) || "unknown",
      start,
      end,
    };
  });
}

function cloneScopes(scopes) {
  if (!Array.isArray(scopes)) {
    return [];
  }

  return scopes.map((scope, index) => ({
    title: stringField(scope.title || scope.name) || `Scope ${index + 1}`,
    status: normalizeStatusValue(scope.status),
    start: formatDateInput(scope.start),
    end: formatDateInput(scope.end || scope.due),
  }));
}

function formatDateInput(value) {
  const date = parseDateField(value);
  return date ? formatDate(date) : "";
}

function pickField(data, names) {
  for (const name of names) {
    if (data[name] !== undefined && data[name] !== null && data[name] !== "") {
      return data[name];
    }
  }

  return null;
}

function stringField(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean).join(", ");
  }

  return String(value).trim();
}

function normalizeList(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeLinear(value) {
  const items = normalizeList(value);
  return items.length ? items : [];
}

function parseDateField(value) {
  if (!value) {
    return null;
  }

  const raw = Array.isArray(value) ? value[0] : value;
  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

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

  for (const child of group.children) {
    sortRoadmapTree(child);
  }
}

function compareGroups(a, b) {
  const aNumber = leadingNumber(a.name);
  const bNumber = leadingNumber(b.name);

  if (aNumber !== null && bNumber !== null && aNumber !== bNumber) {
    return aNumber - bNumber;
  }

  if (aNumber !== null && bNumber === null) {
    return -1;
  }

  if (aNumber === null && bNumber !== null) {
    return 1;
  }

  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

function compareFeatures(a, b) {
  const aStart = earliestFeatureDate(a);
  const bStart = earliestFeatureDate(b);

  if (aStart && bStart && aStart.getTime() !== bStart.getTime()) {
    return aStart.getTime() - bStart.getTime();
  }

  if (aStart && !bStart) {
    return -1;
  }

  if (!aStart && bStart) {
    return 1;
  }

  return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" });
}

function earliestFeatureDate(feature) {
  const items = feature.scopes.length ? feature.scopes : [feature];
  const dates = items.map((item) => item.start).filter(Boolean);
  return dates.length ? minDate(dates) : null;
}

function leadingNumber(value) {
  const match = String(value || "").match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function countGroups(group) {
  return group.children.reduce((count, child) => count + 1 + countGroups(child), 0);
}

function timelineItemsForFeatures(features, hideUndated) {
  return features
    .flatMap((feature) => feature.scopes.length ? feature.scopes : [feature])
    .filter((item) => !hideUndated || (item.start && item.end));
}

function buildTimeline(items, scale) {
  const dated = items.filter((item) => item.start && item.end);
  const today = new Date();
  const normalizedScale = TIMELINE_SCALES[scale] ? scale : DEFAULT_SETTINGS.timelineScale;
  let start = alignStart(new Date(today.getFullYear(), today.getMonth(), 1), normalizedScale);
  let end = alignEnd(new Date(today.getFullYear(), today.getMonth() + 3, 0), normalizedScale);

  if (dated.length) {
    start = minDate(dated.map((item) => item.start));
    end = maxDate(dated.map((item) => item.end));
    start = alignStart(start, normalizedScale);
    end = alignEnd(end, normalizedScale);
  }

  const totalMs = Math.max(1, end.getTime() - start.getTime());
  const ticks = [];
  let cursor = new Date(start);

  while (cursor <= end) {
    const next = nextTick(cursor, normalizedScale);
    const tickEnd = new Date(Math.min(next.getTime() - 1, end.getTime()));
    const left = percentBetween(cursor, start, totalMs);
    const width = Math.max(2, percentBetween(tickEnd, start, totalMs) - left);

    ticks.push({
      label: formatTickLabel(cursor, normalizedScale),
      left,
      width,
    });

    cursor = next;
  }

  return { start, end, totalMs, ticks, scale: normalizedScale, width: timelineWidth(ticks.length, normalizedScale) };
}

function timelineWidth(tickCount, scale) {
  const columnWidth = {
    week: 150,
    twoWeeks: 170,
    month: 190,
    quarter: 220,
  }[scale] || 160;

  return Math.max(980, tickCount * columnWidth);
}

function alignStart(date, scale) {
  if (scale === "month") {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  if (scale === "quarter") {
    return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
  }

  return startOfWeek(date);
}

function alignEnd(date, scale) {
  if (scale === "month") {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  if (scale === "quarter") {
    const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
    return new Date(date.getFullYear(), quarterStartMonth + 3, 0);
  }

  const weekStart = startOfWeek(date);
  const days = scale === "twoWeeks" ? 13 : 6;
  return addDays(weekStart, days);
}

function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}

function nextTick(date, scale) {
  if (scale === "month") {
    return new Date(date.getFullYear(), date.getMonth() + 1, 1);
  }

  if (scale === "quarter") {
    return new Date(date.getFullYear(), date.getMonth() + 3, 1);
  }

  return addDays(date, scale === "twoWeeks" ? 14 : 7);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatTickLabel(date, scale) {
  if (scale === "quarter") {
    return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
  }

  if (scale === "month") {
    return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }

  const end = addDays(date, scale === "twoWeeks" ? 13 : 6);
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

function minDate(dates) {
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

function maxDate(dates) {
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function percentBetween(date, start, totalMs) {
  return ((date.getTime() - start.getTime()) / totalMs) * 100;
}

function normalizeFolderList(value) {
  const raw = Array.isArray(value) ? value.join("\n") : String(value || "");
  return raw
    .split(/[\n,]/)
    .map((folder) => folder.trim().replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);
}

function isFileIncluded(file, includedFolders) {
  if (!includedFolders.length) {
    return true;
  }

  return includedFolders.some((folder) => file.path === folder || file.path.startsWith(`${folder}/`));
}

function isFileExcluded(file, excludedFolders) {
  return excludedFolders.some((folder) => file.path === folder || file.path.startsWith(`${folder}/`));
}

function getVisibleRootGroups(root, includedFolders) {
  if (!includedFolders.length) {
    return root.children;
  }

  const roots = [];
  const seen = new Set();

  for (const folder of includedFolders) {
    const group = findGroup(root, folder);
    const children = group ? group.children : [];

    for (const child of children) {
      if (!seen.has(child.path)) {
        seen.add(child.path);
        roots.push(child);
      }
    }
  }

  return roots;
}

function findGroup(group, path) {
  if (group.path === path) {
    return group;
  }

  for (const child of group.children) {
    const found = findGroup(child, path);
    if (found) {
      return found;
    }
  }

  return null;
}

function formatIncludedFolders(folders) {
  return folders.length ? folders.join(", ") : "whole vault";
}

function renderGroup(parent, group, timeline, view, depth) {
  const plugin = view.plugin;

  if (!hasVisibleGroupContent(group, plugin.settings.hideUndated)) {
    return;
  }

  const isCollapsed = view.collapsedGroups.has(group.path);
  const groupEl = parent.createDiv({ cls: "prm-group" });
  groupEl.toggleClass("is-collapsed", isCollapsed);
  groupEl.style.setProperty("--prm-depth", String(depth));

  const header = groupEl.createDiv({ cls: "prm-group-header" });
  const toggle = header.createEl("button", { cls: "prm-group-toggle", attr: { "aria-label": isCollapsed ? "Expand group" : "Collapse group" } });
  setIcon(toggle, isCollapsed ? "chevron-right" : "chevron-down");
  const toggleGroup = () => {
    if (view.collapsedGroups.has(group.path)) {
      view.collapsedGroups.delete(group.path);
    } else {
      view.collapsedGroups.add(group.path);
    }
    view.render();
  };
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleGroup();
  });
  header.addEventListener("click", toggleGroup);
  header.createDiv({ cls: "prm-group-name", text: group.title || group.name });

  if (isCollapsed) {
    return;
  }

  for (const feature of group.features) {
    if (isFeatureVisible(feature, plugin.settings.hideUndated)) {
      renderFeature(groupEl, feature, timeline, plugin, depth + 1);
    }
  }

  for (const child of group.children) {
    renderGroup(groupEl, child, timeline, view, depth + 1);
  }
}

function hasVisibleGroupContent(group, hideUndated) {
  const hasVisibleFeatures = group.features.some((feature) => isFeatureVisible(feature, hideUndated));
  return hasVisibleFeatures || group.children.some((child) => hasVisibleGroupContent(child, hideUndated));
}

function isFeatureVisible(feature, hideUndated) {
  if (!hideUndated) {
    return true;
  }

  return featureItems(feature).some((item) => item.start && item.end);
}

function featureItems(feature) {
  return feature.scopes.length
    ? feature.scopes.map((scope) => Object.assign({ file: feature.file, parentTitle: feature.title }, scope))
    : [feature];
}

function collectVisibleGroupPaths(groups, hideUndated) {
  const paths = [];

  for (const group of groups) {
    if (!hasVisibleGroupContent(group, hideUndated)) {
      continue;
    }

    paths.push(group.path);
    paths.push(...collectVisibleGroupPaths(group.children, hideUndated));
  }

  return paths;
}

function renderFeature(parent, feature, timeline, plugin, depth) {
  const row = parent.createDiv({ cls: "prm-row" });
  row.style.setProperty("--prm-depth", String(depth));

  const lane = row.createDiv({ cls: "prm-lane" });

  const items = featureItems(feature).filter((item) => !plugin.settings.hideUndated || (item.start && item.end));

  if (!items.length) {
    return;
  }

  const datedItems = items.filter((item) => item.start && item.end);
  const undatedItems = items.filter((item) => !item.start || !item.end);

  for (const item of undatedItems) {
    const noDate = lane.createDiv({ cls: "prm-no-date" });
    noDate.createSpan({ text: item.kind === "scope" ? `${feature.title}: ${item.title}` : feature.title });
    noDate.addEventListener("click", () => plugin.app.workspace.getLeaf(false).openFile(feature.file));
  }

  for (const item of datedItems) {
    const left = clamp(percentBetween(item.start, timeline.start, timeline.totalMs), 0, 100);
    const right = clamp(percentBetween(item.end, timeline.start, timeline.totalMs), 0, 100);
    const width = Math.max(1.5, right - left);
    const bar = lane.createDiv({
      cls: `prm-bar prm-bar-${slug(item.status)}`,
      attr: { title: `${feature.title}${item.kind === "scope" ? `: ${item.title}` : ""}: ${formatDate(item.start)} - ${formatDate(item.end)}` },
    });
    bar.dataset.fullTitle = item.kind === "scope" ? `${feature.title}: ${item.title}` : feature.title;

    bar.style.left = `${left}%`;
    bar.style.width = `${width}%`;
    bar.dataset.start = formatDate(item.start);
    bar.dataset.end = formatDate(item.end);

    const leftHandle = bar.createDiv({ cls: "prm-resize prm-resize-left" });
    leftHandle.setAttr("aria-label", "Resize start date");

    const title = bar.createDiv({ cls: "prm-bar-title", text: item.kind === "scope" ? item.title : feature.title });
    title.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      plugin.app.workspace.getLeaf(false).openFile(feature.file);
    });

    const statusSelect = bar.createEl("select", { cls: "prm-status-select", attr: { "aria-label": "Change status" } });
    for (const status of STATUS_OPTIONS) {
      statusSelect.createEl("option", { value: status.value, text: status.label });
    }
    statusSelect.value = normalizeStatusValue(item.status);
    statusSelect.addEventListener("pointerdown", (event) => event.stopPropagation());
    statusSelect.addEventListener("click", (event) => event.stopPropagation());
    statusSelect.addEventListener("change", async (event) => {
      event.stopPropagation();
      const nextStatus = statusSelect.value;
      item.status = nextStatus;
      bar.className = `prm-bar prm-bar-${slug(nextStatus)}`;
      bar.append(leftHandle, title, statusSelect, rightHandle);
      await updateItemFrontmatter(plugin, feature.file, item, { status: nextStatus });
      new Notice(`Status changed: ${item.title}`);
    });

    const rightHandle = bar.createDiv({ cls: "prm-resize prm-resize-right" });
    rightHandle.setAttr("aria-label", "Resize end date");

    wireBarDrag(bar, lane, item, feature.file, timeline, plugin);
    bar.addEventListener("click", (event) => {
      if (bar.dataset.dragged === "true" || event.target.closest(".prm-status-select") || event.target.closest(".prm-resize")) {
        return;
      }

      plugin.app.workspace.getLeaf(false).openFile(feature.file);
    });
  }
}

function wireBarDrag(bar, lane, item, file, timeline, plugin) {
  let drag = null;

  bar.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest(".prm-status-select")) {
      return;
    }

    const handle = event.target.closest(".prm-resize");
    drag = {
      mode: handle?.classList.contains("prm-resize-left") ? "start" : handle?.classList.contains("prm-resize-right") ? "end" : "move",
      pointerId: event.pointerId,
      originalStart: new Date(item.start),
      originalEnd: new Date(item.end),
      start: new Date(item.start),
      end: new Date(item.end),
      pointerStartX: event.clientX,
      pointerStartDate: dateFromClientX(event.clientX, lane, timeline),
      moved: false,
    };

    bar.dataset.dragged = "false";
    bar.addClass("is-dragging");
    bar.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  bar.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    const pointerDate = dateFromClientX(event.clientX, lane, timeline);
    const movement = Math.abs(event.clientX - drag.pointerStartX);

    if (drag.mode === "start") {
      drag.start = minDateValue(pointerDate, addDays(drag.end, -1));
    } else if (drag.mode === "end") {
      drag.end = maxDateValue(pointerDate, addDays(drag.start, 1));
    } else {
      const offsetDays = diffDays(drag.pointerStartDate, pointerDate);
      drag.start = addDays(drag.originalStart, offsetDays);
      drag.end = addDays(drag.originalEnd, offsetDays);
    }

    if (movement > 3 || drag.mode !== "move") {
      drag.moved = true;
      bar.dataset.dragged = "true";
    }
    updateBarPosition(bar, drag.start, drag.end, timeline);
  });

  bar.addEventListener("pointerup", async (event) => {
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    bar.releasePointerCapture(event.pointerId);
    bar.removeClass("is-dragging");

    const changed = formatDate(drag.start) !== formatDate(drag.originalStart) || formatDate(drag.end) !== formatDate(drag.originalEnd);
    item.start = new Date(drag.start);
    item.end = new Date(drag.end);
    drag = null;

    if (changed) {
      await updateItemFrontmatter(plugin, file, item, {
        roadmap_start: formatDate(item.start),
        roadmap_end: formatDate(item.end),
      });
      new Notice(`Dates changed: ${item.title}`);
    }

    window.setTimeout(() => {
      bar.dataset.dragged = "false";
    }, 0);
  });

  bar.addEventListener("pointercancel", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    updateBarPosition(bar, drag.originalStart, drag.originalEnd, timeline);
    bar.removeClass("is-dragging");
    drag = null;
  });
}

function updateBarPosition(bar, start, end, timeline) {
  const left = clamp(percentBetween(start, timeline.start, timeline.totalMs), 0, 100);
  const right = clamp(percentBetween(end, timeline.start, timeline.totalMs), 0, 100);
  const width = Math.max(1.5, right - left);

  bar.style.left = `${left}%`;
  bar.style.width = `${width}%`;
  bar.dataset.start = formatDate(start);
  bar.dataset.end = formatDate(end);
  bar.setAttribute("title", `${bar.querySelector(".prm-bar-title")?.textContent || "Feature"}: ${formatDate(start)} - ${formatDate(end)}`);
}

function dateFromClientX(clientX, lane, timeline) {
  const rect = lane.getBoundingClientRect();
  const ratio = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
  const raw = new Date(timeline.start.getTime() + ratio * timeline.totalMs);
  return new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
}

function diffDays(from, to) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

function minDateValue(a, b) {
  return a.getTime() <= b.getTime() ? a : b;
}

function maxDateValue(a, b) {
  return a.getTime() >= b.getTime() ? a : b;
}

function normalizeStatusValue(status) {
  const value = slug(status);
  return STATUS_OPTIONS.some((option) => option.value === value) ? value : "todo";
}

async function updateFeatureFrontmatter(plugin, file, updates) {
  plugin.suppressAutoRefresh();
  await plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
    for (const [key, value] of Object.entries(updates)) {
      frontmatter[key] = value;
    }
  });
}

async function updateItemFrontmatter(plugin, file, item, updates) {
  if (item.kind !== "scope") {
    await updateFeatureFrontmatter(plugin, file, updates);
    return;
  }

  plugin.suppressAutoRefresh();
  await plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
    if (!Array.isArray(frontmatter.scopes)) {
      frontmatter.scopes = [];
    }

    if (!frontmatter.scopes[item.index]) {
      frontmatter.scopes[item.index] = {};
    }

    const scope = frontmatter.scopes[item.index];
    for (const [key, value] of Object.entries(updates)) {
      if (key === "roadmap_start") {
        scope.start = value;
      } else if (key === "roadmap_end") {
        scope.end = value;
      } else {
        scope[key] = value;
      }
    }
  });
}

function renderUnplannedFeature(parent, feature, app) {
  const item = parent.createDiv({ cls: "prm-unplanned-item" });
  item.createDiv({ cls: "prm-unplanned-title", text: feature.title });
  item.createDiv({ cls: "prm-unplanned-path", text: feature.file.path });
  item.addEventListener("click", () => app.workspace.getLeaf(false).openFile(feature.file));
}

function renderBoard(parent, model, view) {
  const plugin = view.plugin;
  const board = parent.createDiv({ cls: "prm-board" });
  const items = boardItemsForFeatures(model.features).map((item) => {
    const overrideStatus = view.boardStatusOverrides.get(boardItemId(item));
    return overrideStatus ? Object.assign({}, item, { status: overrideStatus }) : item;
  });

  for (const status of STATUS_OPTIONS) {
    const isCollapsed = view.collapsedBoardColumns.has(status.value);
    const column = board.createDiv({ cls: `prm-board-column prm-board-column-${status.value}` });
    column.toggleClass("is-collapsed", isCollapsed);
    const columnItems = items.filter((item) => normalizeStatusValue(item.status) === status.value);
    const header = column.createDiv({ cls: "prm-board-column-header" });
    const title = header.createSpan({ cls: "prm-board-column-title", text: status.label });
    header.createSpan({ cls: "prm-board-count", text: String(columnItems.length) });
    header.addEventListener("click", () => {
      if (view.collapsedBoardColumns.has(status.value)) {
        view.collapsedBoardColumns.delete(status.value);
      } else {
        view.collapsedBoardColumns.add(status.value);
      }
      view.refreshBoard();
    });

    column.addEventListener("dragover", (event) => {
      event.preventDefault();
      column.addClass("is-drop-target");
    });
    column.addEventListener("dragleave", () => {
      column.removeClass("is-drop-target");
    });
    column.addEventListener("drop", async (event) => {
      event.preventDefault();
      column.removeClass("is-drop-target");
      const id = event.dataTransfer?.getData("text/plain");
      const item = items.find((candidate) => boardItemId(candidate) === id);
      if (!item || normalizeStatusValue(item.status) === status.value) {
        return;
      }

      item.status = status.value;
      view.boardStatusOverrides.set(id, status.value);
      await updateItemFrontmatter(plugin, item.file, item, { status: status.value });
      view.refreshBoard();
      new Notice(`Moved to ${status.label}: ${item.title}`);
    });

    const list = column.createDiv({ cls: "prm-board-list" });
    if (!isCollapsed) {
      for (const item of columnItems) {
        renderBoardCard(list, item, plugin);
      }
    }
  }
}

function boardItemsForFeatures(features) {
  return features.flatMap((feature) => {
    if (!feature.scopes.length) {
      return [Object.assign({ parentTitle: "" }, feature)];
    }

    return feature.scopes.map((scope) => Object.assign({ file: feature.file, parentTitle: feature.title }, scope));
  });
}

function renderBoardCard(parent, item, plugin) {
  const card = parent.createDiv({ cls: `prm-board-card prm-board-card-${slug(item.status)}` });
  card.draggable = true;
  card.dataset.itemId = boardItemId(item);
  card.createDiv({ cls: "prm-board-card-title", text: item.title });

  if (item.parentTitle) {
    card.createDiv({ cls: "prm-board-card-parent", text: item.parentTitle });
  }

  if (item.start || item.end) {
    card.createDiv({
      cls: "prm-board-card-dates",
      text: `${item.start ? formatDate(item.start) : "No start"} - ${item.end ? formatDate(item.end) : "No end"}`,
    });
  }

  card.addEventListener("dragstart", (event) => {
    card.addClass("is-dragging");
    card.dataset.dragged = "true";
    event.dataTransfer?.setData("text/plain", boardItemId(item));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  });
  card.addEventListener("dragend", () => {
    card.removeClass("is-dragging");
    window.setTimeout(() => {
      card.dataset.dragged = "false";
    }, 0);
  });
  card.addEventListener("click", () => {
    if (card.dataset.dragged === "true") {
      return;
    }

    plugin.app.workspace.getLeaf(false).openFile(item.file);
  });
}

function boardItemId(item) {
  return item.kind === "scope" ? `${item.file.path}::scope::${item.index}` : `${item.file.path}::feature`;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function slug(value) {
  return String(value || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
}

module.exports = PlayMapPlugin;
