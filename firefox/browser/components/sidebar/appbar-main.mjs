/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import {
  html,
  repeat,
  when,
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

  onContextMenu(e) {
    const tabBtn = e.target.closest(".appbar-tab-button");
    const menu = document.getElementById("appbar-context-menu");
    if (!menu) {
      return;
    }
    this._contextTabId = tabBtn ? tabBtn.getAttribute("data-tab-id") : null;
    const tabItems = menu.querySelectorAll("[contexttype='appbar-tab']");
    for (const item of tabItems) {
      item.hidden = !this._contextTabId;
    }
  }

  async onContextMenuCommand(e) {
    const commandId = e.target.id;
    if (commandId === "appbar-context-menu-close-tab" && this._contextTabId) {
      this.tabManager?.closeTab(this._contextTabId);
    } else if (commandId === "appbar-context-menu-reload-tab" && this._contextTabId) {
      this.tabManager?.reloadTab(this._contextTabId);
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
              t => html`
                <moz-button
                  class="appbar-tab-button"
                  data-tab-id=${t.id}
                  type=${activeTabId === t.id && this.controller?.isOpen ? "icon" : "icon ghost"}
                  aria-selected=${activeTabId === t.id && this.controller?.isOpen}
                  title=${t.title || t.url}
                  .iconSrc=${t.iconUrl}
                  @click=${() => this.onTabClick(t.id)}
                >
                </moz-button>
              `
            )}

            <!-- Add Tab Button (+) -->
            <moz-button
              class="appbar-add-tab-button"
              type="icon ghost"
              title="Add page to Appbar"
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
              tool => html`
                <moz-button
                  type=${this.selectedView === tool.view && this.controller?.isOpen ? "icon" : "icon ghost"}
                  aria-selected=${this.selectedView === tool.view && this.controller?.isOpen}
                  title=${tool.title}
                  .iconSrc=${tool.iconUrl}
                  @click=${() => this.showView(tool.view)}
                >
                </moz-button>
              `
            )}
          </div>
        </div>

        <!-- Bottom Actions (Settings / Customize) -->
        <div class="bottom-actions">
          <moz-button
            class="customize-appbar-button"
            type=${this.selectedView === "viewCustomizeAppbar" && this.controller?.isOpen ? "icon" : "icon ghost"}
            aria-selected=${this.selectedView === "viewCustomizeAppbar" && this.controller?.isOpen}
            title="Customize Appbar"
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
