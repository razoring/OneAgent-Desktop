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
    const defaultTools = [
      {
        title: "Bookmarks",
        url: "chrome://browser/content/sidebar/sidebar-bookmarks.html",
        iconUrl: "chrome://browser/skin/bookmark-hollow.svg",
      },
      {
        title: "History",
        url: "chrome://browser/content/sidebar/sidebar-history.html",
        iconUrl: "chrome://browser/skin/history.svg",
      },
      {
        title: "Passwords",
        url: "chrome://global/content/megalist/megalist.html",
        iconUrl: "chrome://browser/skin/login.svg",
      },
      {
        title: "Synced Tabs",
        url: "chrome://browser/content/sidebar/sidebar-syncedtabs.html",
        iconUrl: "chrome://browser/skin/synced-tabs.svg",
      },
    ];

    for (const tool of defaultTools) {
      if (!this._tabs.some(t => t.url === tool.url)) {
        this.createTab(tool.url, {
          title: tool.title,
          iconUrl: tool.iconUrl,
          pinned: true,
          isTool: true,
          deferLoad: true,
          hidden: false,
        });
      }
    }
  }

  createTab(url, options = {}) {
    this._tabCounter++;
    const id = `appbar-tab-${Date.now()}-${this._tabCounter}`;
    const stack = this.browserStack;
    if (!stack) {
      return null;
    }

    let resolvedIcon = options.iconUrl;
    if (!resolvedIcon) {
      try {
        let domain = new URL(url).hostname;
        resolvedIcon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
      } catch (e) {
        resolvedIcon = "chrome://global/skin/icons/defaultFavicon.svg";
      }
    }

    const isInternal = !!options.isTool || url.startsWith("chrome://") || url.startsWith("about:");

    const tab = {
      id,
      url,
      title: options.title || url,
      iconUrl: resolvedIcon,
      pinned: typeof options.pinned === "boolean" ? options.pinned : false,
      hidden: typeof options.hidden === "boolean" ? options.hidden : false,
      isMobile:
        typeof options.isMobile === "boolean"
          ? options.isMobile
          : !isInternal &&
            Services.prefs.getBoolPref("browser.appbar.defaultMobile", true),
      isTool: isInternal,
      loaded: false,
      browser: null,
    };

    if (options.deferLoad) {
      this._tabs.push(tab);
      this.appbarMain?.requestUpdate?.();
      return tab;
    }

    this._ensureTabLoaded(tab);
    this._tabs.push(tab);
    this.appbarMain?.requestUpdate?.();

    if (options.select) {
      this.selectTab(id);
    }

    return tab;
  }

  _ensureTabLoaded(tab) {
    if (tab.loaded && tab.browser) {
      return tab.browser;
    }

    const stack = this.browserStack;
    if (!stack) {
      return null;
    }

    const isInternal = tab.isTool || tab.url.startsWith("chrome://") || tab.url.startsWith("about:");

    const browser = this.document.createXULElement("browser");
    browser.setAttribute("id", `appbar-browser-${tab.id}`);
    browser.setAttribute("autoscroll", "false");
    browser.setAttribute("disablehistory", "true");
    browser.setAttribute("disablefullscreen", "true");
    browser.setAttribute("tooltip", "aHTMLTooltip");
    browser.setAttribute("selected", "false");
    browser.style.display = "none";

    if (!isInternal) {
      browser.setAttribute("type", "content");
      browser.setAttribute("remote", "true");
      browser.setAttribute("remoteType", "web");
      browser.setAttribute("maychangeremoteness", "true");
      browser.setAttribute("messagemanagergroup", "browsers");
    }

    stack.appendChild(browser);
    tab.browser = browser;

    const mobileUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    try {
      if (tab.isMobile && !isInternal && browser.browsingContext) {
        browser.browsingContext.customUserAgent = mobileUA;
      }
    } catch (e) {}

    // Track tab updates via webProgress listener
    const progressListener = {
      QueryInterface: ChromeUtils.generateQI([
        "nsIWebProgressListener",
        "nsISupportsWeakReference",
      ]),
      onLocationChange: (aWebProgress, aRequest, aLocation, aFlags) => {
        if (!aLocation) {
          return;
        }
        tab.url = aLocation.spec;
        if (this._selectedTabId === tab.id) {
          this._updateBottomBar(tab);
        }
      },
      onStatusChange: () => {},
      onProgressChange: () => {},
      onSecurityChange: (aWebProgress, aRequest, aState) => {
        tab.securityState = aState;
        if (this._selectedTabId === tab.id) {
          this._updateSecurityButton(tab);
        }
      },
      onContentBlockingEvent: () => {},
    };

    try {
      browser.addProgressListener(progressListener);
      tab._progressListener = progressListener;
    } catch (e) {}

    const updateTabInfo = () => {
      try {
        if (browser.contentTitle) {
          tab.title = browser.contentTitle;
        }
        if (browser.currentURI?.spec) {
          tab.url = browser.currentURI.spec;
          let domain = browser.currentURI.host;
          if (domain) {
            tab.iconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
          }
        }
        tab.loaded = true;
        if (this._selectedTabId === tab.id) {
          this._updateBottomBar(tab);
        }
        this.appbarMain?.requestUpdate?.();
      } catch (e) {}
    };

    browser.addEventListener("DOMContentLoaded", updateTabInfo);
    browser.addEventListener("load", updateTabInfo, true);

    browser.setAttribute("src", tab.url);
    tab.loaded = true;
    return browser;
  }

  _unloadTab(tab) {
    if (!tab) {
      return;
    }
    if (tab.browser) {
      try {
        if (tab._progressListener) {
          tab.browser.removeProgressListener(tab._progressListener);
        }
        tab.browser.remove();
      } catch (e) {}
      tab.browser = null;
    }
    tab.loaded = false;
    tab.securityState = null;
  }

  pinTab(tabId) {
    const tab = this._tabs.find(t => t.id === tabId);
    if (tab) {
      tab.pinned = true;
      this.appbarMain?.requestUpdate?.();
    }
  }

  unpinTab(tabId) {
    const tab = this._tabs.find(t => t.id === tabId);
    if (tab) {
      tab.pinned = false;
      this.appbarMain?.requestUpdate?.();
    }
  }

  moveTab(fromId, toId) {
    const fromIndex = this._tabs.findIndex(t => t.id === fromId);
    const toIndex = this._tabs.findIndex(t => t.id === toId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return;
    }
    const targetPinned = this._tabs[toIndex].pinned;
    const [movedTab] = this._tabs.splice(fromIndex, 1);
    const insertIndex = fromIndex < toIndex ? newToIndex + 1 : newToIndex;
    this._tabs.splice(insertIndex, 0, movedTab);
    this.appbarMain?.requestUpdate?.();
  }

  toggleTabVisibility(tabId, visible) {
    const tab = this._tabs.find(t => t.id === tabId);
    if (tab) {
      tab.hidden = typeof visible === "boolean" ? !visible : !tab.hidden;
      if (tab.hidden && this._selectedTabId === tabId) {
        this.closePanel();
      }
      this.appbarMain?.requestUpdate?.();
    }
  }

  reorderTabs(sourceId, targetId) {
    const fromIndex = this._tabs.findIndex(t => t.id === sourceId);
    const toIndex = this._tabs.findIndex(t => t.id === targetId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return;
    }
    const [movedTab] = this._tabs.splice(fromIndex, 1);
    this._tabs.splice(toIndex, 0, movedTab);
    this.appbarMain?.requestUpdate?.();
  }

  selectTab(tabId) {
    const tab = this._tabs.find(t => t.id === tabId);
    if (!tab) {
      return;
    }

    const appbarBox = this.document.getElementById("appbar-box");
    // Consider the app active only when it is actually displayed: re-clicking
    // its tab toggles the panel closed, but not when a tool view (e.g. the
    // Add apps panel) is currently on screen.
    const isCurrentlyActive =
      this._selectedTabId === tabId &&
      appbarBox &&
      !appbarBox.hidden &&
      !!tab.browser?.hasAttribute?.("selected");

    // Confirmed requirement: Re-clicking active tab toggles (closes) the panel
    if (isCurrentlyActive) {
      this.closePanel();
      return;
    }

    // Ensure browser is loaded into memory when selected
    this._ensureTabLoaded(tab);

    this._selectedTabId = tabId;

    // Hide the chrome tool browser
    const toolBrowser = this.document.getElementById("appbar");
    if (toolBrowser) {
      toolBrowser.removeAttribute("selected");
      toolBrowser.style.display = "none";
    }
    // Bring selected browser to front without unloading others
    for (const t of this._tabs) {
      if (t.browser) {
        if (t.id === tabId) {
          t.browser.setAttribute("selected", "true");
          t.browser.style.display = "flex";
        } else {
          t.browser.removeAttribute("selected");
          t.browser.style.display = "none";
        }
      }
    }

    // Update Bottom Bar
    this._updateBottomBar(tab);

    // A web app is now displayed rather than a chrome tool
    let appbarMain = this.appbarMain;
    if (appbarMain) {
      appbarMain.selectedView = "";
    }

    // Open panel
    if (appbarBox) {
      appbarBox.hidden = false;
    }
    const appbarSplitter = this.document.getElementById("appbar-splitter");
    if (appbarSplitter) {
      appbarSplitter.hidden = false;
    }

    const contentArea = this.document.getElementById("tabbrowser-tabbox");
    contentArea?.setAttribute("appbar-panel-open", "true");

    this.appbarMain?.requestUpdate?.();
  }

  closePanel() {
    this._window.AppbarController?.hidePanel();
  }

  closeTab(tabId) {
    const index = this._tabs.findIndex(t => t.id === tabId);
    if (index === -1) {
      return;
    }

    const tab = this._tabs[index];

    if (tab.pinned) {
      // Pinned tabs stay in the appbar list, but are unloaded from memory
      this._unloadTab(tab);

      if (this._selectedTabId === tabId) {
        this.closePanel();
      }
    } else {
      // Unpinned tabs are completely removed
      this._tabs.splice(index, 1);
      this._unloadTab(tab);

      if (this._selectedTabId === tabId) {
        if (this._tabs.length > 0) {
          const nextIndex = Math.max(0, index - 1);
          this.selectTab(this._tabs[nextIndex].id);
        } else {
          this.closePanel();
        }
      }
    }

    this.appbarMain?.requestUpdate?.();
  }

  removeTab(tabId) {
    const index = this._tabs.findIndex(t => t.id === tabId);
    if (index === -1) {
      return;
    }

    const tab = this._tabs[index];
    if (tab.isTool) {
      tab.hidden = true;
      if (this._selectedTabId === tabId) {
        this.closePanel();
      }
      this.appbarMain?.requestUpdate?.();
      return;
    }

    this._tabs.splice(index, 1);
    this._unloadTab(tab);

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

  toggleMobile(tabId) {
    const tab = this._tabs.find(t => t.id === tabId);
    if (!tab?.browser) {
      return;
    }
    tab.isMobile = !tab.isMobile;
    const mobileUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    try {
      if (tab.browser.browsingContext) {
        tab.browser.browsingContext.customUserAgent = tab.isMobile ? mobileUA : "";
      }
      tab.browser.reload?.();
    } catch (e) {}
    this._updateBottomBar(tab);
  }

  openInNormalBrowser(tabId) {
    const tab = this._tabs.find(t => t.id === tabId);
    if (!tab) {
      return;
    }
    const targetUrl = tab.url || tab.browser?.currentURI?.spec;
    if (targetUrl && this._window.gBrowser) {
      this._window.gBrowser.addTab(targetUrl, {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
      // Optionally focus the newly opened tab
      const newTab = this._window.gBrowser.tabs[this._window.gBrowser.tabs.length - 1];
      if (newTab) {
        this._window.gBrowser.selectedTab = newTab;
      }
    }
  }

  loadUrlInCurrentTab(url) {
    const tab = this.currentTab;
    if (!tab || !url) {
      return;
    }
    let target = url.trim();
    if (!/^[a-zA-Z]+:\/\//i.test(target) && !target.startsWith("about:")) {
      target = "https://" + target;
    }
    tab.url = target;
    tab.browser.setAttribute("src", target);
  }

  _updateBottomBar(tab) {
    if (!tab) {
      return;
    }
    const url = tab.url || tab.browser?.currentURI?.spec || "";
    const isInternal = tab.isTool || !url || url.startsWith("about:") || url.startsWith("chrome://");

    const appbarBox = this.document.getElementById("appbar-box");
    if (appbarBox) {
      if (isInternal) {
        appbarBox.setAttribute("internal-app", "true");
      } else {
        appbarBox.removeAttribute("internal-app");
      }
    }

    const urlContainer = this.document.getElementById("appbar-urlbar-container");
    if (urlContainer) {
      urlContainer.hidden = isInternal;
    }
    const openBtn = this.document.getElementById("appbar-open-tab-button");
    if (openBtn) {
      openBtn.hidden = isInternal;
    }
    const mobileBtn = this.document.getElementById("appbar-toggle-mobile-button");
    if (mobileBtn) {
      mobileBtn.hidden = isInternal;
      mobileBtn.setAttribute("aria-pressed", tab.isMobile ? "true" : "false");
    }

    const urlInput = this.document.getElementById("appbar-url-input");
    if (urlInput && this.document.activeElement !== urlInput) {
      urlInput.value = url;
    }

    this._updateSecurityButton(tab);
  }

  _updateSecurityButton(tab) {
    const secBtn = this.document.getElementById("appbar-identity-button");
    const secIcon = this.document.getElementById("appbar-identity-icon");
    if (!secBtn || !secIcon) {
      return;
    }

    const url = tab.url || tab.browser?.currentURI?.spec || "";
    let isSecure = false;
    let isChrome = false;
    try {
      const uri = Services.io.newURI(url);
      isSecure = uri.scheme === "https";
      isChrome = uri.scheme === "chrome" || uri.scheme === "about";
    } catch (e) {}

    if (isSecure) {
      secIcon.setAttribute("src", "chrome://browser/skin/trust-icon-active.svg");
      secBtn.setAttribute("class", "identity-box-button verifiedDomain secure");
      secBtn.setAttribute("tooltiptext", "Connection secure");
    } else if (isChrome) {
      secIcon.setAttribute("src", "chrome://global/skin/icons/info.svg");
      secBtn.setAttribute("class", "identity-box-button chromeUI secure");
      secBtn.setAttribute("tooltiptext", "Firefox internal page");
    } else {
      secIcon.setAttribute("src", "chrome://browser/skin/trust-icon-insecure.svg");
      secBtn.setAttribute("class", "identity-box-button notSecure insecure");
      secBtn.setAttribute("tooltiptext", "Connection not secure");
    }
  }

  _updateHeader(tab) {
    this._updateBottomBar(tab);
  }
}
