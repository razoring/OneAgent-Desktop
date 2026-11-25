/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const getTopWin = () => window.browsingContext?.topChromeWindow || window.opener || window;
const ctl = () => getTopWin().AppbarController;
const tabMgr = () => ctl()?.tabManager;

let autocompleteDebounceTimer = null;
let currentAutocompleteItems = [];
let selectedAutocompleteIndex = -1;
let draggedRowId = null;

async function queryPlaces(searchTerm) {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return [];
  }

  try {
    const { PlacesUtils } = ChromeUtils.importESModule(
      "resource://gre/modules/PlacesUtils.sys.mjs"
    );
    const db = await PlacesUtils.promiseDBConnection();
    const queryPattern = `%${searchTerm.toLowerCase()}%`;
    const rows = await db.executeCached(
      `SELECT url, title, rev_host
       FROM moz_places
       WHERE (LOWER(title) LIKE :query OR LOWER(url) LIKE :query)
         AND hidden = 0
         AND url NOT LIKE 'about:%'
         AND url NOT LIKE 'chrome://%'
         AND url NOT LIKE 'resource://%'
       ORDER BY frecency DESC, visit_count DESC
       LIMIT 6`,
      { query: queryPattern }
    );

    const results = [];
    for (const row of rows) {
      const url = row.getResultByName("url");
      let title = row.getResultByName("title");
      if (!title) {
        try {
          title = new URL(url).hostname;
        } catch (e) {
          title = url;
        }
      }
      let icon = "chrome://global/skin/icons/defaultFavicon.svg";
      try {
        const domain = new URL(url).hostname;
        icon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
      } catch (e) {}
      results.push({ url, title, icon });
    }
    return results;
  } catch (err) {
    console.error("Places query error in appbar autocomplete:", err);
    return [];
  }
}

async function getFrequentlyVisitedSites() {
  try {
    const { PlacesUtils } = ChromeUtils.importESModule(
      "resource://gre/modules/PlacesUtils.sys.mjs"
    );
    const db = await PlacesUtils.promiseDBConnection();
    const rows = await db.executeCached(
      `SELECT url, title, visit_count
       FROM moz_places
       WHERE hidden = 0
         AND visit_count > 0
         AND url NOT LIKE 'about:%'
         AND url NOT LIKE 'chrome://%'
         AND url NOT LIKE 'resource://%'
       ORDER BY visit_count DESC
       LIMIT 16`
    );

    const sites = [];
    for (const row of rows) {
      const url = row.getResultByName("url");
      let title = row.getResultByName("title");
      if (!title) {
        try {
          title = new URL(url).hostname;
        } catch (e) {
          title = url;
        }
      }
      let icon = "chrome://global/skin/icons/defaultFavicon.svg";
      try {
        const domain = new URL(url).hostname;
        icon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
      } catch (e) {}
      sites.push({ url, title, icon });
    }
    if (sites.length > 0) {
      return sites;
    }
  } catch (err) {
    console.error("Failed to query moz_places for frequently visited:", err);
  }

  // Fallback to AboutNewTab top sites
  try {
    const { AboutNewTab } = ChromeUtils.importESModule(
      "resource:///modules/AboutNewTab.sys.mjs"
    );
    const topSites = AboutNewTab.getTopSites() || [];
    return topSites.map(s => {
      let icon = "chrome://global/skin/icons/defaultFavicon.svg";
      try {
        const domain = new URL(s.url).hostname;
        icon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
      } catch (e) {}
      return {
        url: s.url,
        title: s.title || s.label || s.url,
        icon,
      };
    });
  } catch (e) {
    return [];
  }
}

async function renderFrequentlyVisited() {
  const grid = document.getElementById("freq-grid");
  if (!grid) {
    return;
  }
  grid.replaceChildren();

  const sites = await getFrequentlyVisitedSites();
  if (sites.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state-text";
    empty.textContent = "No frequent sites found";
    grid.append(empty);
    return;
  }

  // Cap to 12 items for max 2 rows
  const displaySites = sites.slice(0, 12);

  for (const site of displaySites) {
    const tile = document.createElement("div");
    tile.className = "app-tile";
    tile.title = `Open ${site.title}`;

    const img = document.createElement("img");
    img.className = "tile-icon";
    img.src = site.icon;
    img.alt = "";

    const titleEl = document.createElement("span");
    titleEl.className = "tile-title";
    titleEl.textContent = site.title;

    tile.append(img, titleEl);
    tile.addEventListener("click", () => {
      // User decision: Open immediately as an active unpinned app in Appbar
      tabMgr()?.createTab(site.url, {
        title: site.title,
        iconUrl: site.icon,
        pinned: false,
        select: true,
      });
      renderAll();
    });

    grid.append(tile);
  }

  trimFreqGridToTwoRows();
}

function trimFreqGridToTwoRows() {
  const grid = document.getElementById("freq-grid");
  const tiles = grid ? Array.from(grid.children) : [];
  if (!tiles.length) {
    return;
  }

  // Show all tiles first so row positions reflect the current width
  tiles.forEach(tile => {
    tile.hidden = false;
  });
  const rowTops = new Set(tiles.map(tile => tile.offsetTop));
  const visibleTops = new Set([...rowTops].sort((a, b) => a - b).slice(0, 2));
  tiles.forEach(tile => {
    tile.hidden = !visibleTops.has(tile.offsetTop);
  });
}

function renderPinnedApps() {
  const container = document.getElementById("pinned-list");
  if (!container) {
    return;
  }
  container.replaceChildren();

  const pinnedTabs = (tabMgr()?.tabs || []).filter(t => t.pinned);

  if (pinnedTabs.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state-text";
    empty.textContent = "No pinned apps";
    container.append(empty);
    return;
  }

  for (const tab of pinnedTabs) {
    const row = document.createElement("div");
    row.className = "pinned-row";
    row.setAttribute("data-tab-id", tab.id);

    // Drag Handle with move icon
    const handle = document.createElement("div");
    handle.className = "drag-handle";
    handle.title = "Drag to reposition";
    handle.draggable = true;

    const handleImg = document.createElement("img");
    handleImg.src = "chrome://global/skin/icons/move-16.svg";
    handleImg.alt = "Reorder";
    handle.append(handleImg);

    // Drag-and-drop event handlers
    handle.addEventListener("dragstart", e => {
      draggedRowId = tab.id;
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", tab.id);
    });

    handle.addEventListener("dragend", () => {
      draggedRowId = null;
      row.classList.remove("dragging");
      document.querySelectorAll(".pinned-row").forEach(r => {
        r.classList.remove("drag-over-top", "drag-over-bottom");
      });
    });

    row.addEventListener("dragover", e => {
      e.preventDefault();
      if (!draggedRowId || draggedRowId === tab.id) {
        return;
      }
      e.dataTransfer.dropEffect = "move";
      const rect = row.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        row.classList.add("drag-over-top");
        row.classList.remove("drag-over-bottom");
      } else {
        row.classList.add("drag-over-bottom");
        row.classList.remove("drag-over-top");
      }
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("drag-over-top", "drag-over-bottom");
    });

    row.addEventListener("drop", e => {
      e.preventDefault();
      row.classList.remove("drag-over-top", "drag-over-bottom");
      if (!draggedRowId || draggedRowId === tab.id) {
        return;
      }
      tabMgr()?.reorderTabs(draggedRowId, tab.id);
      draggedRowId = null;
      renderPinnedApps();
    });

    // Favicon
    const icon = document.createElement("img");
    icon.className = "pinned-icon";
    icon.src = tab.iconUrl || "chrome://global/skin/icons/defaultFavicon.svg";
    icon.alt = "";

    // Title
    const title = document.createElement("span");
    title.className = "pinned-title";
    title.textContent = tab.title || tab.url;

    // Actions block: Visibility Toggle & Delete
    const actions = document.createElement("div");
    actions.className = "pinned-actions";

    // Visibility Toggle Switch - native moz-toggle as used in Settings
    const isVisible = !tab.hidden;
    const toggleBtn = document.createElement("moz-toggle");
    toggleBtn.pressed = isVisible;
    toggleBtn.title = isVisible ? "Visible in Appbar (click to hide)" : "Hidden in Appbar (click to show)";

    toggleBtn.addEventListener("toggle", () => {
      tabMgr()?.toggleTabVisibility(tab.id);
      renderPinnedApps();
    });
    actions.append(toggleBtn);

    // Delete Button - only for custom apps (default tools cannot be deleted)
    if (!tab.isTool) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn-delete";
      deleteBtn.title = "Remove from Pinned apps";

      const delImg = document.createElement("img");
      delImg.src = "chrome://global/skin/icons/delete.svg";
      delImg.alt = "Delete";
      deleteBtn.append(delImg);

      deleteBtn.addEventListener("click", () => {
        tabMgr()?.closeTab(tab.id);
        renderAll();
      });
      actions.append(deleteBtn);
    }

    row.append(handle, icon, title, actions);
    container.append(row);
  }
}

let manageRenderSeq = 0;

function collectBrowserPids(bc, pids = new Set()) {
  if (!bc) {
    return pids;
  }
  const pid = bc.currentWindowGlobal?.osPid;
  if (pid) {
    pids.add(pid);
  }
  for (const child of bc.children || []) {
    collectBrowserPids(child, pids);
  }
  return pids;
}

async function getTabResourcePercentages(activeTabs) {
  const percentages = new Map();
  try {
    const procInfo = await ChromeUtils.requestProcInfo();
    const procByPid = new Map([[procInfo.pid, procInfo]]);
    let totalMemory = procInfo.memory || 0;
    for (const child of procInfo.children || []) {
      procByPid.set(child.pid, child);
      totalMemory += child.memory || 0;
    }

    const tabPids = new Map();
    const pidShareCount = new Map();
    for (const tab of activeTabs) {
      const pids = collectBrowserPids(tab.browser?.browsingContext);
      tabPids.set(tab.id, pids);
      for (const pid of pids) {
        if (pid !== procInfo.pid) {
          pidShareCount.set(pid, (pidShareCount.get(pid) || 0) + 1);
        }
      }
    }

    for (const tab of activeTabs) {
      const pids = tabPids.get(tab.id);
      let tabMemory = 0;
      for (const pid of pids) {
        if (pid !== procInfo.pid) {
          const proc = procByPid.get(pid);
          const shares = pidShareCount.get(pid) || 1;
          tabMemory += (proc?.memory || 0) / shares;
        }
      }
      const pct = totalMemory > 0 ? (tabMemory / totalMemory) * 100 : 0;
      if (pct >= 1) {
        percentages.set(tab.id, `${Math.round(pct)}%`);
      } else if (pct > 0) {
        percentages.set(tab.id, `${pct.toFixed(1)}%`);
      } else {
        percentages.set(tab.id, "< 1%");
      }
    }
  } catch (err) {
    for (const tab of activeTabs) {
      percentages.set(tab.id, "—");
    }
  }
  return percentages;
}

async function renderManageApps() {
  const list = document.getElementById("manage-list");
  const section = document.getElementById("section-manage-apps");
  if (!list || !section) {
    return;
  }

  // Active apps are those loaded in memory
  const allTabs = tabMgr()?.tabs || [];
  const activeTabs = allTabs.filter(t => t.loaded);

  if (activeTabs.length === 0) {
    list.replaceChildren();
    section.hidden = true;
    return;
  }
  section.hidden = false;

  const seq = ++manageRenderSeq;
  const percentages = await getTabResourcePercentages(activeTabs);
  if (seq !== manageRenderSeq) {
    return;
  }

  list.replaceChildren();

  for (const tab of activeTabs) {
    const row = document.createElement("div");
    row.className = "pinned-row manage-row";
    row.title = `Active: ${tab.title || tab.url}`;

    const img = document.createElement("img");
    img.className = "pinned-icon";
    img.src = tab.iconUrl || "chrome://global/skin/icons/defaultFavicon.svg";
    img.alt = "";

    const titleEl = document.createElement("span");
    titleEl.className = "pinned-title";
    titleEl.textContent = tab.title || tab.url;

    const usageEl = document.createElement("span");
    usageEl.className = "manage-usage";
    usageEl.textContent = percentages.get(tab.id) || "< 1%";
    usageEl.title = "Estimated memory usage";

    // Close button (x) to unload from memory
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "manage-close-btn";
    closeBtn.title = "Close app to save memory";

    const closeImg = document.createElement("img");
    closeImg.src = "chrome://global/skin/icons/close.svg";
    closeImg.alt = "Close";
    closeBtn.append(closeImg);

    closeBtn.addEventListener("click", e => {
      e.stopPropagation();
      tabMgr()?.closeTab(tab.id);
      renderAll();
    });

    // Clicking row brings it into view
    row.addEventListener("click", () => {
      tabMgr()?.selectTab(tab.id);
      renderAll();
    });

    row.append(img, titleEl, usageEl, closeBtn);
    list.append(row);
  }
}

function renderAll() {
  renderFrequentlyVisited();
  renderPinnedApps();
  renderManageApps();
}

function submitUrl(rawVal, title = null) {
  let val = rawVal.trim();
  if (!val) {
    return;
  }
  if (!/^[a-zA-Z]+:\/\//i.test(val) && !val.startsWith("about:") && !val.startsWith("chrome://")) {
    if (val.includes(".") && !val.includes(" ")) {
      val = "https://" + val;
    } else {
      val = "https://www.google.com/search?q=" + encodeURIComponent(val);
    }
  }

  // Create as a pinned app
  tabMgr()?.createTab(val, {
    title: title || val,
    pinned: true,
    select: false,
    hidden: false,
  });

  const input = document.getElementById("url");
  if (input) {
    input.value = "";
  }
  closeAutocomplete();
  renderAll();
}

// Autocomplete Handlers
function renderAutocomplete(items) {
  const dropdown = document.getElementById("autocomplete-dropdown");
  dropdown.replaceChildren();
  currentAutocompleteItems = items;
  selectedAutocompleteIndex = -1;

  if (items.length === 0) {
    dropdown.style.display = "none";
    return;
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const el = document.createElement("div");
    el.className = "autocomplete-item";
    el.setAttribute("data-index", i);

    const img = document.createElement("img");
    img.className = "item-icon";
    img.src = item.icon || "chrome://global/skin/icons/defaultFavicon.svg";
    img.alt = "";

    const textWrapper = document.createElement("div");
    textWrapper.className = "item-text";

    const titleEl = document.createElement("span");
    titleEl.className = "item-title";
    titleEl.textContent = item.title;

    const urlEl = document.createElement("span");
    urlEl.className = "item-url";
    urlEl.textContent = item.url;

    textWrapper.append(titleEl, urlEl);
    el.append(img, textWrapper);

    el.addEventListener("mousedown", e => {
      e.preventDefault();
      submitUrl(item.url, item.title);
    });

    dropdown.append(el);
  }

  dropdown.style.display = "block";
}

function closeAutocomplete() {
  const dropdown = document.getElementById("autocomplete-dropdown");
  if (dropdown) {
    dropdown.style.display = "none";
  }
  currentAutocompleteItems = [];
  selectedAutocompleteIndex = -1;
}

function updateAutocompleteSelection() {
  const dropdown = document.getElementById("autocomplete-dropdown");
  const children = dropdown?.querySelectorAll(".autocomplete-item") || [];
  children.forEach((child, idx) => {
    if (idx === selectedAutocompleteIndex) {
      child.classList.add("selected");
      child.scrollIntoView({ block: "nearest" });
      const input = document.getElementById("url");
      if (input && currentAutocompleteItems[idx]) {
        input.value = currentAutocompleteItems[idx].url;
      }
    } else {
      child.classList.remove("selected");
    }
  });
}

// Search input and form setup
const urlInput = document.getElementById("url");
const clearBtn = document.getElementById("search-clear-btn");

if (urlInput) {
  urlInput.addEventListener("input", e => {
    const val = e.target.value;
    if (clearBtn) {
      clearBtn.style.display = val.length > 0 ? "flex" : "none";
    }

    clearTimeout(autocompleteDebounceTimer);
    if (!val || val.trim().length === 0) {
      closeAutocomplete();
      return;
    }

    autocompleteDebounceTimer = setTimeout(async () => {
      const items = await queryPlaces(val);
      renderAutocomplete(items);
    }, 120);
  });

  urlInput.addEventListener("keydown", e => {
    const dropdown = document.getElementById("autocomplete-dropdown");
    const isDropdownVisible = dropdown && dropdown.style.display === "block";

    if (e.key === "ArrowDown") {
      if (isDropdownVisible && currentAutocompleteItems.length > 0) {
        e.preventDefault();
        selectedAutocompleteIndex = (selectedAutocompleteIndex + 1) % currentAutocompleteItems.length;
        updateAutocompleteSelection();
      }
    } else if (e.key === "ArrowUp") {
      if (isDropdownVisible && currentAutocompleteItems.length > 0) {
        e.preventDefault();
        selectedAutocompleteIndex =
          selectedAutocompleteIndex <= 0
            ? currentAutocompleteItems.length - 1
            : selectedAutocompleteIndex - 1;
        updateAutocompleteSelection();
      }
    } else if (e.key === "Escape") {
      closeAutocomplete();
    }
  });

  urlInput.addEventListener("blur", () => {
    setTimeout(() => closeAutocomplete(), 200);
  });
}

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    if (urlInput) {
      urlInput.value = "";
      urlInput.focus();
    }
    clearBtn.style.display = "none";
    closeAutocomplete();
  });
}

const addForm = document.getElementById("add-form");
if (addForm) {
  addForm.addEventListener("submit", e => {
    e.preventDefault();
    if (urlInput && urlInput.value.trim()) {
      submitUrl(urlInput.value);
    }
  });
}

const freqGrid = document.getElementById("freq-grid");
if (freqGrid) {
  new ResizeObserver(() => trimFreqGridToTwoRows()).observe(freqGrid);
}

renderAll();

const topWin = getTopWin();
const onAppbarTabsChanged = () => {
  renderPinnedApps();
  renderManageApps();
};
const onVisibilityChange = () => {
  if (document.visibilityState === "visible") {
    renderAll();
  }
};
topWin.addEventListener("appbar-tabs-changed", onAppbarTabsChanged);
document.addEventListener("visibilitychange", onVisibilityChange);
window.addEventListener("pageshow", () => renderAll());
window.addEventListener(
  "unload",
  () => {
    topWin.removeEventListener("appbar-tabs-changed", onAppbarTabsChanged);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  },
  { once: true }
);
