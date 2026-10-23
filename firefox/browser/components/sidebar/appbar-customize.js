/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const getTopWin = () => window.browsingContext?.topChromeWindow || window.opener || window;
const ctl = () => getTopWin().AppbarController;

const DEFAULT_TOOLS = [
  {
    id: "bookmarks",
    title: "Bookmarks",
    desc: "Quick access to your bookmarks",
    url: "chrome://browser/content/sidebar/sidebar-bookmarks.html",
    iconUrl: "chrome://browser/skin/bookmark-hollow.svg",
  },
  {
    id: "history",
    title: "History",
    desc: "Recent browsing history",
    url: "chrome://browser/content/sidebar/sidebar-history.html",
    iconUrl: "chrome://browser/skin/history.svg",
  },
  {
    id: "passwords",
    title: "Passwords",
    desc: "Saved logins and passwords",
    url: "chrome://global/content/megalist/megalist.html",
    iconUrl: "chrome://browser/skin/login.svg",
  },
  {
    id: "syncedtabs",
    title: "Tabs from other devices",
    desc: "Synced tabs across your devices",
    url: "chrome://browser/content/sidebar/sidebar-syncedtabs.html",
    iconUrl: "chrome://browser/skin/synced-tabs.svg",
  },
];

function isAppAdded(url) {
  const tabs = ctl()?.tabManager?.tabs || [];
  return tabs.some(t => t.url === url);
}

function renderCurrentPage() {
  const section = document.getElementById("section-current-page");
  const topWin = getTopWin();
  const gBrowser = topWin.gBrowser;
  if (!gBrowser) {
    section.style.display = "none";
    return;
  }

  const selectedBrowser = gBrowser.selectedBrowser;
  const currentURI = selectedBrowser?.currentURI?.spec;
  if (!currentURI || (!currentURI.startsWith("http://") && !currentURI.startsWith("https://"))) {
    section.style.display = "none";
    return;
  }

  const selectedTab = gBrowser.selectedTab;
  const currentTitle = selectedBrowser?.contentTitle || selectedTab?.label || currentURI;
  let currentIcon = "chrome://global/skin/icons/defaultFavicon.svg";
  try {
    if (gBrowser.getIcon) {
      currentIcon = gBrowser.getIcon(selectedTab) || currentIcon;
    }
  } catch (e) {}

  section.style.display = "block";
  document.getElementById("current-page-icon").src = currentIcon;
  document.getElementById("current-page-title").textContent = currentTitle;
  document.getElementById("current-page-url").textContent = currentURI;

  const addBtn = document.getElementById("add-current-page-btn");
  const added = isAppAdded(currentURI);
  addBtn.textContent = added ? "Added" : "Add";
  addBtn.disabled = added;
  addBtn.onclick = () => {
    ctl()?.tabManager?.createTab(currentURI, {
      title: currentTitle,
      iconUrl: currentIcon,
      pinned: false,
      select: true,
    });
    renderAll();
  };
}

function renderTopSites() {
  const grid = document.getElementById("top-sites-grid");
  grid.replaceChildren();

  let topSites = [];
  try {
    const { AboutNewTab } = ChromeUtils.importESModule("resource:///modules/AboutNewTab.sys.mjs");
    topSites = AboutNewTab.getTopSites() || [];
  } catch (e) {}

  if (!topSites || topSites.length === 0) {
    topSites = [
      { title: "YouTube", url: "https://www.youtube.com" },
      { title: "Google", url: "https://www.google.com" },
      { title: "GitHub", url: "https://github.com" },
      { title: "Wikipedia", url: "https://www.wikipedia.org" },
      { title: "Reddit", url: "https://www.reddit.com" },
      { title: "X", url: "https://x.com" },
    ];
  }

  const sitesToDisplay = topSites.slice(0, 8);
  for (const site of sitesToDisplay) {
    if (!site.url) {
      continue;
    }
    const tile = document.createElement("div");
    tile.className = "top-site-tile";

    let iconUrl = site.iconUrl;
    if (!iconUrl) {
      try {
        const domain = new URL(site.url).hostname;
        iconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
      } catch (e) {
        iconUrl = "chrome://global/skin/icons/defaultFavicon.svg";
      }
    }

    const img = document.createElement("img");
    img.className = "site-icon";
    img.src = iconUrl;

    const titleEl = document.createElement("div");
    titleEl.className = "site-title";
    titleEl.textContent = site.title || site.label || site.url;

    tile.append(img, titleEl);
    tile.title = `Add ${site.title || site.url} to Appbar`;
    tile.addEventListener("click", () => {
      ctl()?.tabManager?.createTab(site.url, {
        title: site.title || site.label || site.url,
        iconUrl,
        pinned: false,
        select: true,
      });
      renderAll();
    });
    grid.append(tile);
  }
}

function renderFirefoxTools() {
  const container = document.getElementById("firefox-tools-list");
  container.replaceChildren();

  for (const tool of DEFAULT_TOOLS) {
    const item = document.createElement("div");
    item.className = "tool-item";

    const img = document.createElement("img");
    img.className = "tool-icon";
    img.src = tool.iconUrl;

    const info = document.createElement("div");
    info.className = "tool-info";

    const name = document.createElement("div");
    name.className = "tool-name";
    name.textContent = tool.title;

    const desc = document.createElement("div");
    desc.className = "tool-desc";
    desc.textContent = tool.desc;

    info.append(name, desc);

    const btn = document.createElement("button");
    const added = isAppAdded(tool.url);
    btn.className = added ? "btn btn-secondary" : "btn btn-primary";
    btn.textContent = added ? "Added" : "Add";
    btn.disabled = added;
    btn.addEventListener("click", () => {
      ctl()?.tabManager?.createTab(tool.url, {
        title: tool.title,
        iconUrl: tool.iconUrl,
        isTool: true,
        pinned: false,
        select: true,
      });
      renderAll();
    });

    item.append(img, info, btn);
    container.append(item);
  }
}

function renderActiveApps() {
  const list = document.getElementById("apps");
  const section = document.getElementById("section-active-apps");
  list.replaceChildren();

  const tabs = ctl()?.tabManager?.tabs || [];
  if (tabs.length === 0) {
    section.style.display = "none";
    return;
  }
  section.style.display = "block";

  for (const tab of tabs) {
    const row = document.createElement("div");
    row.className = "app-row";

    const img = document.createElement("img");
    img.src = tab.iconUrl || "chrome://global/skin/icons/defaultFavicon.svg";

    const label = document.createElement("span");
    label.textContent = tab.title || tab.url;

    if (tab.pinned) {
      const pinBadge = document.createElement("span");
      pinBadge.className = "badge-pinned";
      pinBadge.textContent = "Pinned";
      row.append(img, label, pinBadge);
    } else {
      row.append(img, label);
    }

    const btn = document.createElement("button");
    btn.className = "btn btn-secondary btn-remove";
    btn.textContent = "Remove";
    btn.addEventListener("click", () => {
      ctl()?.tabManager?.closeTab(tab.id);
      renderAll();
    });

    row.append(btn);
    list.append(row);
  }
}

function renderAll() {
  renderCurrentPage();
  renderTopSites();
  renderFirefoxTools();
  renderActiveApps();
}

document.getElementById("add-form").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("url");
  let val = input.value.trim();
  if (!val) {
    return;
  }
  if (!/^[a-zA-Z]+:\/\//i.test(val)) {
    if (val.includes(".") && !val.includes(" ")) {
      val = "https://" + val;
    } else {
      val = "https://www.google.com/search?q=" + encodeURIComponent(val);
    }
  }
  ctl()?.tabManager?.createTab(val, { pinned: false, select: true });
  input.value = "";
  renderAll();
});

renderAll();
