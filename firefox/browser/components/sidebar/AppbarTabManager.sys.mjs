/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class AppbarTabManager {
  constructor(window) {
    this._window = window;
    this._tabs = [];
    this._selectedTabId = null;
    this._tabCounter = 0;
  }

  get tabs() {
    return this._tabs;
  }

  get selectedTabId() {
    return this._selectedTabId;
  }

  get currentTab() {
    return this._tabs.find(t => t.id === this._selectedTabId);
  }

  get document() {
    return this._window.document;
  }

  get browserStack() {
    return this.document.getElementById("appbar-browser-stack");
  }

  get appbarMain() {
    return this.document.querySelector("appbar-main");
  }

  init() {
    // Initial default tab if empty
    if (this._tabs.length === 0) {
      this.createTab("https://www.google.com", {
        title: "Search",
        iconUrl: "chrome://global/skin/icons/search-glass.svg",
        select: false,
      });
    }
  }

  createTab(url, options = {}) {
    this._tabCounter++;
    const id = `appbar-tab-${Date.now()}-${this._tabCounter}`;
    const stack = this.browserStack;
    if (!stack) {
      return null;
    }

    const browser = this.document.createXULElement("browser");
    browser.setAttribute("id", `appbar-browser-${id}`);
    browser.setAttribute("type", "content");
    browser.setAttribute("remote", "true");
    browser.setAttribute("disablehistory", "false");
    browser.setAttribute("messagemanagergroup", "browsers");
    browser.setAttribute("tooltip", "aHTMLTooltip");
    browser.setAttribute("autoscroll", "false");
    browser.setAttribute("selected", "false");

    stack.appendChild(browser);

    let resolvedIcon = options.iconUrl;
    if (!resolvedIcon) {
      try {
        let domain = new URL(url).hostname;
        resolvedIcon = `page-icon:https://${domain}/`;
      } catch (e) {
        resolvedIcon = "chrome://global/skin/icons/defaultFavicon.svg";
      }
    }

    const tab = {
      id,
      url,
      title: options.title || url,
      iconUrl: resolvedIcon,
      browser,
    };

    // Load URL
    browser.setAttribute("src", url);

    // Track tab updates (title and icon)
    browser.addEventListener("DOMContentLoaded", () => {
      try {
        if (browser.contentDocument?.title) {
          tab.title = browser.contentDocument.title;
          if (this._selectedTabId === id) {
            this._updateHeader(tab);
          }
          this.appbarMain?.requestUpdate?.();
        }
      } catch (e) {}
    });

    this._tabs.push(tab);
    this.appbarMain?.requestUpdate?.();

    if (options.select) {
      this.selectTab(id);
    }

    return tab;
  }

  selectTab(tabId) {
    const tab = this._tabs.find(t => t.id === tabId);
    if (!tab) {
      return;
    }

    const appbarBox = this.document.getElementById("appbar-box");
    const appbarSplitter = this.document.getElementById("appbar-splitter");
    const isCurrentlyActive = this._selectedTabId === tabId && appbarBox && !appbarBox.hidden;

    // Confirmed requirement: Re-clicking active tab toggles (closes) the panel
    if (isCurrentlyActive) {
      this.closePanel();
      return;
    }

    this._selectedTabId = tabId;

    // Bring selected browser to front
    for (const t of this._tabs) {
      if (t.id === tabId) {
        t.browser.setAttribute("selected", "true");
        t.browser.style.display = "flex";
      } else {
        t.browser.removeAttribute("selected");
        t.browser.style.display = "none";
      }
    }

    // Update Header
    this._updateHeader(tab);

    // Open panel
    if (appbarBox) {
      appbarBox.hidden = false;
    }
    if (appbarSplitter) {
      appbarSplitter.hidden = false;
    }

    const contentArea = this.document.getElementById("tabbrowser-tabbox");
    contentArea?.setAttribute("appbar-panel-open", "true");

    this.appbarMain?.requestUpdate?.();
  }

  closePanel() {
    const appbarBox = this.document.getElementById("appbar-box");
    const appbarSplitter = this.document.getElementById("appbar-splitter");
    if (appbarBox) {
      appbarBox.hidden = true;
    }
    if (appbarSplitter) {
      appbarSplitter.hidden = true;
    }

    const contentArea = this.document.getElementById("tabbrowser-tabbox");
    contentArea?.removeAttribute("appbar-panel-open");

    this._selectedTabId = null;
    this.appbarMain?.requestUpdate?.();
  }

  closeTab(tabId) {
    const index = this._tabs.findIndex(t => t.id === tabId);
    if (index === -1) {
      return;
    }

    const [tab] = this._tabs.splice(index, 1);
    try {
      tab.browser.remove();
    } catch (e) {}

    if (this._selectedTabId === tabId) {
      if (this._tabs.length > 0) {
        const nextIndex = Math.max(0, index - 1);
        this.selectTab(this._tabs[nextIndex].id);
      } else {
        this.closePanel();
      }
    }

    this.appbarMain?.requestUpdate?.();
  }

  reloadTab(tabId) {
    const tab = this._tabs.find(t => t.id === tabId);
    if (tab?.browser) {
      tab.browser.reload?.();
    }
  }

  _updateHeader(tab) {
    const titleEl = this.document.getElementById("appbar-title");
    const iconEl = this.document.getElementById("appbar-icon");
    if (titleEl) {
      titleEl.value = tab.title || tab.url;
    }
    if (iconEl && tab.iconUrl) {
      iconEl.setAttribute("src", tab.iconUrl);
    }
  }
}
