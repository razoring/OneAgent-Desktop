/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { OneAgentOrchestrator } from "moz-src:///browser/components/oneagent/core/OneAgentOrchestrator.sys.mjs";

export class OneAgentUI {
  static BOX_ID = "oneagent-box";
  static SPLITTER_ID = "oneagent-splitter";

  static isSidebarOpen(win) {
    const box = win?.document?.getElementById(this.BOX_ID);
    return box && !box.hidden && !box.collapsed;
  }

  static toggleSidebar(win, show = null) {
    if (!win || !win.document) {
      return;
    }
    const box = win.document.getElementById(this.BOX_ID);
    const splitter = win.document.getElementById(this.SPLITTER_ID);
    if (!box) {
      return;
    }

    const isCurrentlyHidden = box.hidden || box.collapsed;
    const shouldShow = show !== null ? show : isCurrentlyHidden;

    box.hidden = !shouldShow;
    box.collapsed = !shouldShow;
    if (splitter) {
      splitter.hidden = !shouldShow;
      splitter.collapsed = !shouldShow;
    }

    const browser = win.document.getElementById("oneagent-browser");
    if (shouldShow && browser) {
      const targetSrc = "chrome://browser/content/oneagent/sidebar.html";
      if (!browser.getAttribute("src") || browser.getAttribute("src") !== targetSrc) {
        browser.setAttribute("src", targetSrc);
      }
    }

    Services.prefs.setBoolPref("browser.oneagent.sidebar.open", shouldShow);
    const btn = win.document.getElementById("oneagent-button");
    if (btn) {
      btn.toggleAttribute("checked", shouldShow);
    }
  }

  static initWindow(win) {
    if (!win || !win.document) {
      return;
    }
    win.OneAgentUI = OneAgentUI;
    const isOpen = Services.prefs.getBoolPref("browser.oneagent.sidebar.open", false);
    if (isOpen) {
      this.toggleSidebar(win, true);
    }

    // Attach overlay manager
    if (!win.OneAgentTabOverlayManager) {
      win.OneAgentTabOverlayManager = {
        ensureOverlay(tab) {
          const panelEl = win.document.getElementById(tab.linkedPanel);
          const stack = panelEl?.querySelector(".browserStack");
          if (!stack) {
            return null;
          }
          let overlay = stack.querySelector("oneagent-tab-overlay");
          if (!overlay) {
            overlay = win.document.createElement("oneagent-tab-overlay");
            stack.appendChild(overlay);
          }
          return overlay;
        },

        highlightTarget(browser, data) {
          const tab = win.gBrowser?.getTabForBrowser(browser);
          if (tab) {
            const overlay = this.ensureOverlay(tab);
            overlay?.showTarget(data);
          }
        },
      };
    }

    // Tab state observer
    win.gBrowser?.tabContainer?.addEventListener("TabAttrModified", event => {
      const tab = event.target;
      if (event.detail.changed?.includes("oneagent-state")) {
        const state = tab.getAttribute("oneagent-state");
        const overlay = win.OneAgentTabOverlayManager.ensureOverlay(tab);
        if (overlay) {
          overlay.setAttribute("state", state || "hidden");
        }
      }
    });

    // Keyboard shortcut Accel+Shift+A
    win.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === "A" || event.key === "a")) {
        event.preventDefault();
        this.toggleSidebar(win);
      }
    });
  }
}
