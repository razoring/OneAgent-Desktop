/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html, repeat } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

const TASKBAR_VISIBLE_PREF = "taskbar.visible";
const TAB_EVENTS = [
  "TabOpen",
  "TabClose",
  "TabMove",
  "TabSelect",
  "TabPinned",
  "TabUnpinned",
  "TabShow",
  "TabHide",
  "TabAttrModified",
  "SSTabRestored",
];
const TAB_ATTRS = [
  "label",
  "image",
  "busy",
  "selected",
  "pinned",
  "hidden",
  "muted",
  "soundplaying",
  "attention",
];

/**
 * Taskbar: a static right-docked strip mirroring the current window's open
 * tabs. Unlike the sidebar launcher it never expands on hover and has no
 * attached panel; visibility is controlled by the taskbar.visible pref.
 */
class SidebarTaskbar extends MozLitElement {
  static properties = {
    pinnedTabs: { type: Array },
    tabs: { type: Array },
  };

  constructor() {
    super();
    this.pinnedTabs = [];
    this.tabs = [];
    this._renderScheduled = false;
    this._scrollToSelected = false;
    this._onTabEvent = () => this.scheduleRender();
    this._onTabSelect = () => {
      this._scrollToSelected = true;
      this.scheduleRender();
    };
    this._onPrefChange = () => this.applyVisibility();
  }

  get browserWindow() {
    return this.ownerDocument.defaultView;
  }

  get taskbarContainer() {
    return this.ownerDocument.getElementById("taskbar-container");
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this.browserWindow.gBrowser?.tabContainer) {
      this.browserWindow.addEventListener("load", () => this._init(), {
        once: true,
      });
      return;
    }
    this._init();
  }

  _init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;
    const win = this.browserWindow;
    this._tabContainer = win.gBrowser.tabContainer;
    for (const type of TAB_EVENTS) {
      if (type === "TabSelect") {
        this._tabContainer.addEventListener(type, this._onTabSelect);
      } else {
        this._tabContainer.addEventListener(type, this._onTabEvent);
      }
    }
    this._observer = new MutationObserver(this._onTabEvent);
    this._observer.observe(this._tabContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: TAB_ATTRS,
    });
    Services.prefs.addObserver(TASKBAR_VISIBLE_PREF, this._onPrefChange);
    this.applyVisibility();
    this.refreshTabs();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    for (const type of TAB_EVENTS) {
      this._tabContainer?.removeEventListener(
        type,
        type === "TabSelect" ? this._onTabSelect : this._onTabEvent
      );
    }
    this._observer?.disconnect();
    this._observer = null;
    if (this._onPrefChange) {
      Services.prefs.removeObserver(TASKBAR_VISIBLE_PREF, this._onPrefChange);
    }
  }

  get popupWindow() {
    const win = this.browserWindow;
    return (
      !win.toolbar?.visible ||
      win.document.documentElement.hasAttribute("taskbartab") ||
      win.document.documentElement.hasAttribute("mini-window")
    );
  }

  applyVisibility() {
    const show =
      Services.prefs.getBoolPref(TASKBAR_VISIBLE_PREF, true) &&
      !this.popupWindow;
    this.taskbarContainer.hidden = !show;
    for (const button of this.ownerDocument.querySelectorAll(
      'toolbarbutton#taskbar-toggle'
    )) {
      button.toggleAttribute("checked", show);
    }
  }

  scheduleRender() {
    if (this._renderScheduled) {
      return;
    }
    this._renderScheduled = true;
    this.browserWindow.requestAnimationFrame(() => {
      this._renderScheduled = false;
      this.refreshTabs();
    });
  }

  refreshTabs() {
    const tabs = [...this.browserWindow.gBrowser.tabs];
    this.pinnedTabs = tabs.filter(tab => tab.pinned && !tab.hidden);
    this.tabs = tabs.filter(tab => !tab.pinned && !tab.hidden);
  }

  updated() {
    if (this._scrollToSelected) {
      this._scrollToSelected = false;
      this.shadowRoot
        .querySelector(".taskbar-tab[selected]")
        ?.scrollIntoView({ block: "nearest" });
    }
  }

  getIconForTab(tab) {
    const image = tab.getAttribute("image");
    if (image && !image.startsWith("http")) {
      return image;
    }
    const uri = tab.linkedBrowser?.currentURI?.spec;
    if (uri) {
      return `page-icon:${uri}`;
    }
    if (image) {
      return image;
    }
    return "chrome://global/skin/icons/defaultFavicon.svg";
  }

  selectTab(tab) {
    const gBrowser = this.browserWindow.gBrowser;
    gBrowser.selectedTab = tab;
    tab.linkedBrowser?.focus();
  }

  closeTab(tab) {
    this.browserWindow.gBrowser.removeTab(tab);
  }

  openTab() {
    const win = this.browserWindow;
    if (typeof win.goDoCommand === "function") {
      win.goDoCommand("cmd_NewTab");
    } else {
      win.gBrowser.selectedTab = win.gBrowser.addTab("about:newtab", {
        triggeringPrincipal:
          Services.scriptSecurityManager.getSystemPrincipal(),
      });
    }
  }

  onRowKeydown(e, tab) {
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        this.selectTab(tab);
        break;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        this.closeTab(tab);
        break;
    }
  }

  tabRowTemplate(tab) {
    return html`
      <div
        class="taskbar-tab"
        role="button"
        tabindex="0"
        ?selected=${tab.selected}
        aria-selected=${tab.selected}
        aria-label=${tab.label}
        title=${tab.label}
        @click=${() => this.selectTab(tab)}
        @mousedown=${e => {
          if (e.button === 1) {
            e.preventDefault();
          }
        }}
        @auxclick=${e => {
          if (e.button === 1) {
            e.preventDefault();
            this.closeTab(tab);
          }
        }}
        @keydown=${e => this.onRowKeydown(e, tab)}
      >
        <img
          class="taskbar-tab-icon"
          src=${this.getIconForTab(tab)}
          alt=""
          draggable="false"
        />
        <span class="taskbar-tab-label">${tab.label}</span>
      </div>
    `;
  }

  render() {
    return html`
      <link
        rel="stylesheet"
        href="chrome://browser/content/sidebar/sidebar-taskbar.css"
      />
      <div
        class="taskbar"
        role="navigation"
        aria-label="Taskbar"
        data-l10n-id="taskbar-strip"
        data-l10n-attrs="aria-label"
      >
        <div class="taskbar-tabs-list">
          ${repeat(
            [...(this.pinnedTabs ?? []), ...(this.tabs ?? [])],
            tab => tab,
            tab => this.tabRowTemplate(tab)
          )}
        </div>
        <moz-button
          class="taskbar-newtab"
          type="icon ghost"
          title="Open a new tab"
          data-l10n-id="taskbar-new-tab-button"
          data-l10n-attrs="title"
          .iconSrc=${"chrome://global/skin/icons/plus.svg"}
          @click=${this.openTab}
        ></moz-button>
      </div>
    `;
  }
}

customElements.define("sidebar-taskbar", SidebarTaskbar);
