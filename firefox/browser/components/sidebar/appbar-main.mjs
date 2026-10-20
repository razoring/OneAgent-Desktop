/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import {
  html,
  ifDefined,
  repeat,
  when,
  classMap,
} from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

export default class AppbarMain extends MozLitElement {
  static properties = {
    selectedView: { type: String },
    selectedTabId: { type: String },
    isDragOver: { type: Boolean, reflect: true, attribute: "dragover" },
  };

  constructor() {
    super();
    this.selectedView = "";
    this.selectedTabId = null;
    this.isDragOver = false;
  }

  get controller() {
    return window.AppbarController;
  }

  get tabManager() {
    return window.AppbarController?.tabManager;
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("dragover", this.onDragOver.bind(this));
    this.addEventListener("dragleave", this.onDragLeave.bind(this));
    this.addEventListener("drop", this.onDrop.bind(this));

    const appbarContainer = document.getElementById("appbar-container");
    const appbarContextMenu = document.getElementById("appbar-context-menu");
    if (appbarContainer && appbarContextMenu) {
      appbarContainer.addEventListener("contextmenu", this.onContextMenu.bind(this));
      appbarContextMenu.addEventListener("command", this.onContextMenuCommand.bind(this));
    }
  }

  async onContextMenu(e) {
    const path = e.composedPath ? e.composedPath() : [e.target];
    const tabBtn = path.find(el => el.classList && el.classList.contains("appbar-tab-button"));
    const toolBtn = path.find(el => el.getAttribute && el.getAttribute("view") && el.tagName?.toLowerCase() === "moz-button");
    const menu = document.getElementById("appbar-context-menu");
    if (!menu) {
      return;
    }

    this._contextTabId = tabBtn ? tabBtn.getAttribute("data-tab-id") : null;
    this._contextToolView = toolBtn ? toolBtn.getAttribute("view") : null;
    this._contextExtensionId = toolBtn ? toolBtn.getAttribute("extensionId") : null;

    const pinItem = document.getElementById("appbar-context-menu-pin-tab");
    const unpinItem = document.getElementById("appbar-context-menu-unpin-tab");
    const closeItem = document.getElementById("appbar-context-menu-close-tab");
    const reloadItem = document.getElementById("appbar-context-menu-reload-tab");
    const tabSeparator = document.getElementById("appbar-context-menu-tab-separator");
    const manageExtItem = document.getElementById("appbar-context-menu-manage-extension");
    const reportExtItem = document.getElementById("appbar-context-menu-report-extension");
    const extSeparator = document.getElementById("appbar-context-menu-extension-separator");

    if (this._contextTabId) {
      const tab = this.tabManager?.tabs.find(t => t.id === this._contextTabId);
      if (pinItem) {
        pinItem.hidden = !!tab?.pinned;
      }
      if (unpinItem) {
        unpinItem.hidden = !tab?.pinned;
      }
      if (closeItem) {
        closeItem.hidden = false;
      }
      if (reloadItem) {
        reloadItem.hidden = false;
      }
      if (tabSeparator) {
        tabSeparator.hidden = false;
      }
    } else {
      if (pinItem) {
        pinItem.hidden = true;
      }
      if (unpinItem) {
        unpinItem.hidden = true;
      }
      if (closeItem) {
        closeItem.hidden = true;
      }
      if (reloadItem) {
        reloadItem.hidden = true;
      }
      if (tabSeparator) {
        tabSeparator.hidden = true;
      }
    }

    // Only show Report Extension and Manage Extension for valid extensions
    let isExtension = false;
    if (this._contextExtensionId) {
      isExtension = true;
    } else if (this._contextToolView?.includes("-sidebar-action") || this._contextToolView?.includes("moz-extension")) {
      isExtension = true;
    }

    let addon = null;
    if (isExtension && this._contextExtensionId && window.AddonManager) {
      try {
        addon = await window.AddonManager.getAddonByID(this._contextExtensionId);
      } catch (err) {}
    }

    if (manageExtItem) {
      manageExtItem.hidden = !isExtension;
    }
    if (reportExtItem) {
      reportExtItem.hidden = !isExtension || !window.gAddonAbuseReportEnabled;
    }
    if (extSeparator) {
      extSeparator.hidden = !isExtension;
    }
  }

  async onContextMenuCommand(e) {
    const commandId = e.target.id;
    if (commandId === "appbar-context-menu-close-tab" && this._contextTabId) {
      this.tabManager?.closeTab(this._contextTabId);
    } else if (commandId === "appbar-context-menu-pin-tab" && this._contextTabId) {
      this.tabManager?.pinTab(this._contextTabId);
    } else if (commandId === "appbar-context-menu-unpin-tab" && this._contextTabId) {
      this.tabManager?.unpinTab(this._contextTabId);
    } else if (commandId === "appbar-context-menu-reload-tab" && this._contextTabId) {
      this.tabManager?.reloadTab(this._contextTabId);
    } else if (commandId === "appbar-context-menu-manage-extension" && this._contextExtensionId) {
      window.BrowserAddonUI?.manageAddon?.(this._contextExtensionId, "appbar-context-menu");
    } else if (commandId === "appbar-context-menu-report-extension" && this._contextExtensionId) {
      window.BrowserAddonUI?.reportAddon?.(this._contextExtensionId, "appbar-context-menu");
    } else if (commandId === "appbar-context-menu-customize-appbar") {
      await this.showView("viewCustomizeAppbar");
    } else if (commandId === "appbar-context-menu-hide-appbar") {
      this.controller?.toggleAppbarVisibility(false);
    }
  }

  onDragOver(e) {
    let types = Array.from(e.dataTransfer.types);
    if (
      [
        "application/x-moz-tabbrowser-tab",
        "text/x-moz-text-internal",
        "text/uri-list",
        "text/plain",
      ].some(t => types.includes(t))
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      this.isDragOver = true;
    }
  }

  onDragLeave() {
    this.isDragOver = false;
  }

  onDrop(e) {
    e.preventDefault();
    this.isDragOver = false;
    let url;
    let types = Array.from(e.dataTransfer.types);
    if (types.includes("application/x-moz-tabbrowser-tab")) {
      let tab = e.dataTransfer.mozGetDataAt(
        "application/x-moz-tabbrowser-tab",
        0
      );
      url = tab?.linkedBrowser?.currentURI?.spec;
    }
    url ||=
      e.dataTransfer.getData("text/uri-list")?.split("\n")[0] ||
      e.dataTransfer.getData("text/plain");

    if (url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("about:"))) {
      this.tabManager?.createTab(url, { select: true });
    }
  }

  onTabClick(tabId) {
    this.selectedView = "";
    this.tabManager?.selectTab(tabId);
  }

  async promptAddTab() {
    let url = window.prompt("Enter web page URL to add to Appbar:", "https://");
    if (url && url.trim() && url !== "https://") {
      let finalUrl = url.trim();
      if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = "https://" + finalUrl;
      }
      this.tabManager?.createTab(finalUrl, { select: true });
    }
  }

  async showView(viewId) {
    const isAlreadyOpen = this.controller?.isOpen && this.selectedView === viewId;
    if (isAlreadyOpen) {
      this.controller?.hidePanel();
      this.selectedView = "";
    } else {
      this.selectedView = viewId;
      await this.controller?.showTool(viewId);
    }
    this.requestUpdate();
  }

  render() {
    const tabs = this.tabManager?.tabs || [];
    const activeTabId = this.tabManager?.selectedTabId;
    const tools = this.controller?.getTools() || [];

    return html`
      <link rel="stylesheet" href="chrome://browser/content/sidebar/appbar.css" />
      <link rel="stylesheet" href="chrome://browser/content/sidebar/appbar-main.css" />

      <div class="wrapper">
        <slot name="tabstrip"></slot>

        <div class="scroll-section">
          <!-- Web Tabs List -->
          <div class="appbar-tabs-list">
            ${repeat(
              tabs,
              t => t.id,
              t => {
                const isSelected = activeTabId === t.id && this.controller?.isOpen;
                const isUnloaded = !t.loaded;
                return html`
                  <moz-button
                    class=${classMap({
                      "appbar-tab-button": true,
                      selected: isSelected,
                      unloaded: isUnloaded,
                    })}
                    data-tab-id=${t.id}
                    ?unloaded=${isUnloaded}
                    type="icon ghost"
                    aria-selected=${isSelected}
                    title=${t.title || t.url}
                    iconsrc=${t.iconUrl}
                    .iconSrc=${t.iconUrl}
                    @click=${() => this.onTabClick(t.id)}
                  >
                  </moz-button>
                `;
              }
            )}

            <!-- Add Tab Button (+) -->
            <moz-button
              class="appbar-add-tab-button"
              type="icon ghost"
              title="Add page to Appbar"
              iconsrc="chrome://global/skin/icons/plus.svg"
              .iconSrc="chrome://global/skin/icons/plus.svg"
              @click=${this.promptAddTab}
            >
            </moz-button>
          </div>

          <div class="appbar-separator"></div>

          <!-- Built-in Tools & Extensions -->
          <div class="tools-and-extensions">
            ${repeat(
              tools,
              tool => tool.view,
              tool => {
                const isSelected = this.selectedView === tool.view && this.controller?.isOpen;
                return html`
                  <moz-button
                    class=${classMap({
                      selected: isSelected,
                    })}
                    type="icon ghost"
                    aria-selected=${isSelected}
                    title=${tool.title}
                    view=${tool.view}
                    extensionId=${ifDefined(tool.extensionId)}
                    iconsrc=${tool.iconUrl}
                    .iconSrc=${tool.iconUrl}
                    @click=${() => this.showView(tool.view)}
                  >
                  </moz-button>
                `;
              }
            )}
          </div>
        </div>

        <!-- Bottom Actions (Settings / Customize) -->
        <div class="bottom-actions">
          <moz-button
            class=${classMap({
              "customize-appbar-button": true,
              selected: this.selectedView === "viewCustomizeAppbar" && this.controller?.isOpen,
            })}
            type="icon ghost"
            aria-selected=${this.selectedView === "viewCustomizeAppbar" && this.controller?.isOpen}
            title="Customize Appbar"
            iconsrc="chrome://global/skin/icons/settings.svg"
            .iconSrc="chrome://global/skin/icons/settings.svg"
            @click=${() => this.showView("viewCustomizeAppbar")}
          >
          </moz-button>
        </div>
      </div>
    `;
  }
}

customElements.define("appbar-main", AppbarMain);
