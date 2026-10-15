/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

var AppbarController = {
  _initialized: false,
  tabManager: null,

  tools: [
    {
      view: "viewBookmarksAppbar",
      title: "Bookmarks",
      url: "chrome://browser/content/sidebar/sidebar-bookmarks.html",
      iconUrl: "chrome://browser/skin/bookmark.svg",
    },
    {
      view: "viewHistoryAppbar",
      title: "History",
      url: "chrome://browser/content/sidebar/sidebar-history.html",
      iconUrl: "chrome://browser/skin/history.svg",
    },
    {
      view: "viewSyncedTabsAppbar",
      title: "Synced Tabs",
      url: "chrome://browser/content/sidebar/sidebar-syncedtabs.html",
      iconUrl: "chrome://browser/skin/device-phone.svg",
    },
    {
      view: "viewGenaiChatAppbar",
      title: "AI Chatbot",
      url: "chrome://browser/content/genai/chat.html",
      iconUrl: "chrome://global/skin/icons/highlights.svg",
    },
    {
      view: "viewCustomizeAppbar",
      title: "Customize Appbar",
      url: "chrome://browser/content/sidebar/appbar-customize.html",
      iconUrl: "chrome://global/skin/icons/settings.svg",
    },
  ],

  get isOpen() {
    let box = document.getElementById("appbar-box");
    return !!(box && !box.hidden);
  },

  get isAppbarVisible() {
    let container = document.getElementById("appbar-container");
    return !!(container && !container.hidden);
  },

  getTools() {
    // Exclude customize from normal tools strip, it is anchored at bottom
    return this.tools.filter(t => t.view !== "viewCustomizeAppbar");
  },

  async init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    // Load custom element if not yet defined
    if (!customElements.get("appbar-main")) {
      try {
        ChromeUtils.importESModule(
          "chrome://browser/content/sidebar/appbar-main.mjs",
          { global: "current" }
        );
      } catch (e) {
        console.error("Failed to load appbar-main.mjs:", e);
      }
    }

    // Import AppbarTabManager
    const { AppbarTabManager } = ChromeUtils.importESModule(
      "moz-src:///browser/components/sidebar/AppbarTabManager.sys.mjs"
    );
    this.tabManager = new AppbarTabManager(window);
    this.tabManager.init();

    // Setup close button
    const closeBtn = document.getElementById("appbar-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.hidePanel());
    }

    // Default container to shown on the right
    let container = document.getElementById("appbar-container");
    if (container) {
      container.hidden = false;
    }
    let contentArea = document.getElementById("tabbrowser-tabbox");
    contentArea?.setAttribute("appbar-shown", "true");
  },

  async showTool(viewId) {
    let tool = this.tools.find(t => t.view === viewId);
    if (!tool) {
      return;
    }

    // Deselect web tabs in tabManager
    if (this.tabManager) {
      this.tabManager._selectedTabId = null;
      for (const t of this.tabManager.tabs) {
        t.browser.removeAttribute("selected");
        t.browser.style.display = "none";
      }
    }

    // Show primary appbar browser
    let defaultBrowser = document.getElementById("appbar");
    if (defaultBrowser) {
      defaultBrowser.setAttribute("selected", "true");
      defaultBrowser.style.display = "flex";
      if (defaultBrowser.getAttribute("src") !== tool.url) {
        defaultBrowser.setAttribute("src", tool.url);
      }
    }

    // Update Header
    let titleEl = document.getElementById("appbar-title");
    let iconEl = document.getElementById("appbar-icon");
    if (titleEl) {
      titleEl.value = tool.title;
    }
    if (iconEl && tool.iconUrl) {
      iconEl.setAttribute("src", tool.iconUrl);
    }

    // Show panel and splitter
    let box = document.getElementById("appbar-box");
    let splitter = document.getElementById("appbar-splitter");
    if (box) {
      box.hidden = false;
    }
    if (splitter) {
      splitter.hidden = false;
    }

    let contentArea = document.getElementById("tabbrowser-tabbox");
    contentArea?.setAttribute("appbar-panel-open", "true");

    let appbarMain = document.querySelector("appbar-main");
    appbarMain?.requestUpdate?.();
  },

  hidePanel() {
    let box = document.getElementById("appbar-box");
    let splitter = document.getElementById("appbar-splitter");
    if (box) {
      box.hidden = true;
    }
    if (splitter) {
      splitter.hidden = true;
    }

    let contentArea = document.getElementById("tabbrowser-tabbox");
    contentArea?.removeAttribute("appbar-panel-open");

    if (this.tabManager) {
      this.tabManager._selectedTabId = null;
    }

    let appbarMain = document.querySelector("appbar-main");
    if (appbarMain) {
      appbarMain.selectedView = "";
      appbarMain.requestUpdate();
    }
  },

  toggleAppbarVisibility(visible = null) {
    let container = document.getElementById("appbar-container");
    if (!container) {
      return;
    }
    let shouldShow = visible !== null ? visible : container.hidden;
    container.hidden = !shouldShow;
    if (!shouldShow) {
      this.hidePanel();
    }
    let contentArea = document.getElementById("tabbrowser-tabbox");
    if (shouldShow) {
      contentArea?.setAttribute("appbar-shown", "true");
    } else {
      contentArea?.removeAttribute("appbar-shown");
    }
  },
};

window.AppbarController = AppbarController;

if (document.readyState === "complete") {
  AppbarController.init();
} else {
  window.addEventListener("load", () => AppbarController.init(), {
    once: true,
  });
}
