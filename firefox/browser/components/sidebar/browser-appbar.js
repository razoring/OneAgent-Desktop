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
    // Hide built-in tools (Bookmarks, History, Synced Tabs, AI Chatbot).
    // Customize Appbar is handled separately in bottom-actions.
    return [];
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

    // Setup bottom bar buttons and URL input
    const closeBtn = document.getElementById("appbar-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        if (this.tabManager?.selectedTabId) {
          this.tabManager.closeTab(this.tabManager.selectedTabId);
        } else {
          this.hidePanel();
        }
      });
    }

    const reloadBtn = document.getElementById("appbar-reload-button");
    if (reloadBtn) {
      reloadBtn.addEventListener("click", () => {
        if (this.tabManager?.selectedTabId) {
          this.tabManager.reloadTab(this.tabManager.selectedTabId);
        } else {
          let defaultBrowser = document.getElementById("appbar");
          defaultBrowser?.reload?.();
        }
      });
    }

    const openNormalBtn = document.getElementById("appbar-open-tab-button");
    if (openNormalBtn) {
      openNormalBtn.addEventListener("click", () => {
        if (this.tabManager?.selectedTabId) {
          this.tabManager.openInNormalBrowser(this.tabManager.selectedTabId);
        }
      });
    }

    const toggleMobileBtn = document.getElementById("appbar-toggle-mobile-button");
    if (toggleMobileBtn) {
      toggleMobileBtn.addEventListener("click", () => {
        if (this.tabManager?.selectedTabId) {
          this.tabManager.toggleMobile(this.tabManager.selectedTabId);
        }
      });
    }

    const secBtn = document.getElementById("appbar-identity-button");
    if (secBtn) {
      secBtn.addEventListener("click", event => {
        event.stopPropagation();
        try {
          const currentTab = this.tabManager?.currentTab;
          const tabBrowser = currentTab?.browser;
          if (window.gTrustPanelHandler) {
            window.gTrustPanelHandler.showPopup({
              anchor: secBtn,
              position: "topleft bottomleft",
              event,
              browser: tabBrowser,
              state: currentTab?.securityState,
              uri: tabBrowser?.currentURI,
              secInfo: tabBrowser?.securityUI?.secInfo,
            });
          } else if (window.gIdentityHandler) {
            window.gIdentityHandler._initializePopup();
            window.gIdentityHandler.refreshIdentityPopup();
            let identityPopup = window.gIdentityHandler._identityPopup;
            if (identityPopup && window.PanelMultiView) {
              window.PanelMultiView.openPopup(identityPopup, secBtn, {
                position: "topleft bottomleft",
                triggerEvent: event,
              });
            }
          }
        } catch (err) {
          console.error("Error opening trust panel from appbar:", err);
        }
      });
    }

    const urlInput = document.getElementById("appbar-url-input");
    if (urlInput) {
      urlInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          this.tabManager?.loadUrlInCurrentTab(urlInput.value);
        }
      });
    }

    // Splitter dragging & width persistence
    const appbarSplitter = document.getElementById("appbar-splitter");
    const appbarBox = document.getElementById("appbar-box");
    if (appbarSplitter && appbarBox) {
      appbarSplitter.addEventListener("command", () => {
        const curWidth = appbarBox.getBoundingClientRect().width;
        if (curWidth > 150) {
          document.documentElement.style.setProperty("--appbar-panel-width", `${curWidth}px`);
        }
      });
      appbarSplitter.addEventListener("pointerdown", () => {
        appbarSplitter.setAttribute("state", "dragging");
      });
      window.addEventListener("pointerup", () => {
        appbarSplitter.removeAttribute("state");
      });
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
        if (t.browser) {
          t.browser.removeAttribute("selected");
          t.browser.style.display = "none";
        }
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
      box.setAttribute("internal-app", "true");
    }
    if (splitter) {
      splitter.hidden = false;
    }

    let urlContainer = document.getElementById("appbar-urlbar-container");
    if (urlContainer) {
      urlContainer.hidden = true;
    }
    let openBtn = document.getElementById("appbar-open-tab-button");
    if (openBtn) {
      openBtn.hidden = true;
    }
    let mobileBtn = document.getElementById("appbar-toggle-mobile-button");
    if (mobileBtn) {
      mobileBtn.hidden = true;
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
      box.removeAttribute("internal-app");
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
