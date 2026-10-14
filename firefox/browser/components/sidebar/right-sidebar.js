/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var RightSidebarController = {
  _panel: null,
  _rail: null,
  _splitter: null,
  _stack: null,
  _tabStrip: null,
  _pinnedIcons: null,
  _tabs: [],
  _activeTabId: null,
  _initialized: false,

  init() {
    if (this._initialized) {
      return;
    }
    this._panel = document.getElementById("right-sidebar-panel");
    this._rail = document.getElementById("right-sidebar-rail");
    this._splitter = document.getElementById("right-sidebar-splitter");
    this._stack = document.getElementById("right-sidebar-stack");
    this._tabStrip = document.getElementById("right-sidebar-tab-strip");
    this._pinnedIcons = document.getElementById("right-sidebar-pinned-icons");

    if (!this._panel || !this._rail) {
      return;
    }
    this._initialized = true;

    // Explicit [X] close button on the LEFT side of the header
    let closeBtn = document.getElementById("right-sidebar-btn-close");
    if (closeBtn) {
      closeBtn.addEventListener("command", () => this.confirmAndCloseAll());
    }

    // Dismiss [-] button on the right side of the header
    let dismissBtn = document.getElementById("right-sidebar-btn-dismiss");
    if (dismissBtn) {
      dismissBtn.addEventListener("command", () => this.dismiss());
    }

    // New Tab button inside header
    let newTabBtn = document.getElementById("right-sidebar-btn-newtab");
    if (newTabBtn) {
      newTabBtn.addEventListener("command", () => this.promptNewTab());
    }

    // Rail toggle button
    let railToggleBtn = document.getElementById("right-sidebar-rail-toggle");
    if (railToggleBtn) {
      railToggleBtn.addEventListener("command", () => this.toggle());
    }

    // Rail add button
    let railAddBtn = document.getElementById("right-sidebar-rail-add");
    if (railAddBtn) {
      railAddBtn.addEventListener("command", () => this.promptPinCurrentPage());
    }

    this.initDefaultPinned();
  },

  initDefaultPinned() {
    if (!this._pinnedIcons || this._pinnedIcons.childElementCount > 0) {
      return;
    }

    const defaultApps = [
      {
        id: "google-search",
        title: "Search",
        url: "https://www.google.com",
        icon: "chrome://global/skin/icons/search-glass.svg",
      },
      {
        id: "web-tools",
        title: "Tools & AI",
        url: "https://duckduckgo.com/?q=AI",
        icon: "chrome://browser/skin/sidebars.svg",
      },
    ];

    for (let app of defaultApps) {
      this.createPinnedButton(app.url, app.title, app.icon);
    }
  },

  createPinnedButton(url, title, iconSrc) {
    if (!this._pinnedIcons) return;

    let btn = document.createXULElement("toolbarbutton");
    btn.className = "tabbable right-sidebar-rail-btn";
    btn.setAttribute("title", title);

    let img = document.createXULElement("image");
    img.className = "toolbarbutton-icon";
    img.setAttribute("src", iconSrc || "chrome://global/skin/icons/defaultFavicon.svg");
    btn.appendChild(img);

    btn.addEventListener("command", () => {
      let existingTab = this._tabs.find(t => t.url === url);
      if (existingTab) {
        this.selectTab(existingTab.id);
        this.show();
      } else {
        this.openTab(url, title, iconSrc);
      }
    });

    this._pinnedIcons.appendChild(btn);
  },

  promptPinCurrentPage() {
    let currentURI = window.gBrowser?.currentURI?.spec;
    let title = window.gBrowser?.selectedBrowser?.contentTitle || "Pinned Page";

    if (!currentURI || currentURI.startsWith("about:")) {
      let urlInput = { value: "https://" };
      let confirmed = Services.prompt.prompt(
        window,
        "Pin Web Page",
        "Enter website URL to pin to sidebar rail:",
        urlInput,
        null,
        { value: false }
      );
      if (confirmed && urlInput.value && urlInput.value !== "https://") {
        this.createPinnedButton(urlInput.value, "Web App");
      }
      return;
    }

    this.createPinnedButton(currentURI, title);
  },

  promptNewTab() {
    let urlInput = { value: "https://www.google.com" };
    let confirmed = Services.prompt.prompt(
      window,
      "Open Sidebar Webview",
      "Enter URL to load into right sidebar:",
      urlInput,
      null,
      { value: false }
    );
    if (confirmed && urlInput.value) {
      this.openTab(urlInput.value, "Web Page");
    }
  },

  confirmAndCloseAll() {
    let confirmDisabled = Services.prefs.getBoolPref(
      "oneagent.sidebar.confirmCloseDisabled",
      false
    );

    if (!confirmDisabled) {
      let checkState = { value: false };
      let confirmed = Services.prompt.confirmCheck(
        window,
        "Close Sidebar",
        "Are you sure you want to terminate all background processes?",
        "Do not ask again",
        checkState
      );
      if (!confirmed) {
        return;
      }
      if (checkState.value) {
        Services.prefs.setBoolPref(
          "oneagent.sidebar.confirmCloseDisabled",
          true
        );
      }
    }

    this.terminateAll();
  },

  terminateAll() {
    for (let tab of this._tabs) {
      if (tab.browser && tab.browser.parentNode) {
        try {
          tab.browser.destroy?.();
        } catch (e) {}
        tab.browser.remove();
      }
    }
    this._tabs = [];
    this._activeTabId = null;
    if (this._tabStrip) {
      this._tabStrip.textContent = "";
    }
    this.hide();
  },

  dismiss() {
    this.hide();
  },

  show() {
    if (!this._panel) return;
    this._panel.hidden = false;
    if (this._splitter) {
      this._splitter.hidden = false;
    }
    document.getElementById("right-sidebar-rail-toggle")?.classList.add("active");
  },

  hide() {
    if (!this._panel) return;
    this._panel.hidden = true;
    if (this._splitter) {
      this._splitter.hidden = true;
    }
    document.getElementById("right-sidebar-rail-toggle")?.classList.remove("active");
  },

  toggle() {
    if (this._panel && this._panel.hidden) {
      this.show();
      if (this._tabs.length === 0) {
        this.openTab("https://www.google.com", "Search");
      }
    } else {
      this.dismiss();
    }
  },

  openTab(url, title = "New Tab", icon = null) {
    if (!this._stack || !this._tabStrip) {
      return null;
    }

    let id = "rstab-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);

    // Native Top-Level Gecko Content Browser (Bypasses iframe & X-Frame-Options limitations)
    let browser = document.createXULElement("browser");
    browser.setAttribute("type", "content");
    browser.setAttribute("remote", "true");
    browser.setAttribute("maychangeremoteness", "true");
    browser.setAttribute("disablehistory", "false");
    browser.setAttribute("class", "right-sidebar-browser-view");
    browser.setAttribute("contextmenu", "contentAreaContextMenu");
    browser.setAttribute("tooltip", "aHTMLTooltip");
    browser.setAttribute("id", "browser-" + id);
    browser.style.display = "none";
    this._stack.appendChild(browser);

    // Header tab pill
    let tabEl = document.createElement("div");
    tabEl.className = "right-sidebar-tab-item";
    tabEl.id = "tab-" + id;

    let titleEl = document.createElement("span");
    titleEl.textContent = title;
    titleEl.className = "right-sidebar-tab-title";
    tabEl.appendChild(titleEl);

    let closeSpan = document.createElement("span");
    closeSpan.textContent = "\u00D7";
    closeSpan.className = "right-sidebar-tab-close";
    closeSpan.title = "Close Tab";
    closeSpan.addEventListener("click", e => {
      e.stopPropagation();
      this.closeTab(id);
    });
    tabEl.appendChild(closeSpan);

    tabEl.addEventListener("click", () => this.selectTab(id));
    this._tabStrip.appendChild(tabEl);

    let tabData = { id, title, url, icon, browser, tabEl, titleEl };
    this._tabs.push(tabData);

    browser.addEventListener("DOMTitleChanged", () => {
      if (browser.contentTitle) {
        tabData.title = browser.contentTitle;
        titleEl.textContent = browser.contentTitle;
      }
    });

    try {
      browser.loadURI(Services.io.newURI(url), {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
    } catch (e) {
      browser.src = url;
    }

    this.selectTab(id);
    this.show();
    return id;
  },

  closeTab(id) {
    let index = this._tabs.findIndex(t => t.id === id);
    if (index === -1) return;

    let tab = this._tabs[index];
    if (tab.browser) {
      try {
        tab.browser.destroy?.();
      } catch (e) {}
      tab.browser.remove();
    }
    if (tab.tabEl) {
      tab.tabEl.remove();
    }
    this._tabs.splice(index, 1);

    if (this._activeTabId === id) {
      if (this._tabs.length > 0) {
        let nextIndex = Math.min(index, this._tabs.length - 1);
        this.selectTab(this._tabs[nextIndex].id);
      } else {
        this._activeTabId = null;
        this.dismiss();
      }
    }
  },

  selectTab(id) {
    this._activeTabId = id;
    for (let tab of this._tabs) {
      if (tab.id === id) {
        tab.browser.style.display = "block";
        tab.tabEl.classList.add("active");
      } else {
        tab.browser.style.display = "none";
        tab.tabEl.classList.remove("active");
      }
    }
  },
};

// Initialize right sidebar controller when main browser window loads
window.addEventListener("DOMContentLoaded", () => {
  RightSidebarController.init();
}, { once: true });
