/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const PIP_URI = "chrome://browser/content/oneagent/desktop-pip.xhtml";

export class DesktopMode {
  static _state = new WeakMap();

  static _getState(win) {
    let state = this._state.get(win);
    if (!state) {
      state = {
        active: false,
        running: true,
        paused: false,
        pipWindow: null,
        streamTimer: null,
        capturing: false,
        chromeCanvas: null,
        compositeCanvas: null,
        savedUrl: null,
      };
      this._state.set(win, state);
    }
    return state;
  }

  static initWindow(win) {
    if (!win?.document) {
      return;
    }
    win.DesktopMode = DesktopMode;
    const toggleBtn = win.document.getElementById("desktop-mode-button");
    if (toggleBtn && !toggleBtn._desktopModeBound) {
      toggleBtn._desktopModeBound = true;
      toggleBtn.addEventListener("command", () => this.toggle(win));
    }
    const powerBtn = win.document.getElementById("desktop-mode-power-btn");
    if (powerBtn && !powerBtn._desktopModeBound) {
      powerBtn._desktopModeBound = true;
      powerBtn.addEventListener("click", () => this.toggleBrowserPower(win));
    }
    const sidebar = win.document.getElementById("desktop-chat-sidebar");
    const sidebarToggle = win.document.getElementById("desktop-chat-sidebar-toggle");
    const headerSidebarToggle = win.document.getElementById("desktop-chat-header-sidebar-toggle");
    if (sidebar && !sidebar._desktopModeBound) {
      sidebar._desktopModeBound = true;
      const setSidebarCollapsed = collapsed => {
        sidebar.toggleAttribute("collapsed", collapsed);
        if (headerSidebarToggle) {
          headerSidebarToggle.hidden = !collapsed;
        }
      };
      sidebarToggle?.addEventListener("click", () => setSidebarCollapsed(true));
      headerSidebarToggle?.addEventListener("click", () => setSidebarCollapsed(false));
      for (const id of ["desktop-chat-browser-btn", "desktop-chat-top-browser-btn"]) {
        win.document.getElementById(id)?.addEventListener("click", () => this.exitToBrowserMode(win));
      }
      win.document.getElementById("desktop-chat-history")?.addEventListener("click", e => {
        const item = e.target.closest(".desktop-history-item");
        if (!item) {
          return;
        }
        for (const el of win.document.querySelectorAll("#desktop-chat-history .desktop-history-item")) {
          el.toggleAttribute("selected", el === item);
        }
        const titleEl = win.document.getElementById("desktop-chat-title");
        if (titleEl) {
          titleEl.textContent = item.textContent;
        }
      });
    }
    win.addEventListener(
      "unload",
      () => {
        this._closePip(win);
      },
      { once: true }
    );
  }

  static toggle(win) {
    if (!win?.document) {
      return;
    }
    const state = this._getState(win);
    if (state.active) {
      this.exitToBrowserMode(win);
    } else {
      this.enterDesktopMode(win);
    }
  }

  static _captureChromeBackdrop(win) {
    const state = this._getState(win);
    try {
      const w = Math.max(1, win.innerWidth);
      const h = Math.max(1, win.innerHeight);
      if (!state.chromeCanvas) {
        state.chromeCanvas = win.document.createElementNS(
          "http://www.w3.org/1999/xhtml",
          "canvas"
        );
      }
      state.chromeCanvas.width = w;
      state.chromeCanvas.height = h;
      const ctx = state.chromeCanvas.getContext("2d");
      ctx.drawWindow(win, 0, 0, w, h, "rgb(19, 18, 21)");
    } catch (e) {}
  }

  static enterDesktopMode(win) {
    const state = this._getState(win);
    // Snapshot the full browser window before overlaying the Desktop Mode canvas
    if (!state.active) {
      this._captureChromeBackdrop(win);
    }
    state.active = true;
    state.paused = false;

    const doc = win.document;
    doc.documentElement.setAttribute("desktop-mode", "true");

    const canvas = doc.getElementById("desktop-mode-canvas");
    if (canvas) {
      canvas.hidden = false;
    }

    const btn = doc.getElementById("desktop-mode-button");
    if (btn) {
      btn.setAttribute("label", "Browser Mode");
      btn.setAttribute("tooltiptext", "Switch to Browser Mode");
      btn.toggleAttribute("checked", true);
    }

    // Keep browser running without losing state; open PiP if running
    if (state.running) {
      this._openPip(win);
    }
    this._syncCanvasUI(win);
  }

  static exitToBrowserMode(win) {
    const state = this._getState(win);
    state.active = false;
    state.paused = false;
    this._closePip(win);

    const doc = win.document;
    doc.documentElement.removeAttribute("desktop-mode");

    const canvas = doc.getElementById("desktop-mode-canvas");
    if (canvas) {
      canvas.hidden = true;
    }

    const btn = doc.getElementById("desktop-mode-button");
    if (btn) {
      btn.setAttribute("label", "Desktop Mode");
      btn.setAttribute("tooltiptext", "Switch to Desktop Mode");
      btn.toggleAttribute("checked", false);
    }

    win.focus();
  }

  static toggleBrowserPower(win) {
    const state = this._getState(win);
    if (state.running) {
      this.stopBrowser(win);
    } else {
      this.startBrowser(win);
    }
  }

  static _restoreStoppedBrowser(win) {
    const state = this._getState(win);
    try {
      const browser = win.gBrowser?.selectedBrowser;
      if (browser && state.savedUrl) {
        const cur = browser.currentURI?.spec || "";
        if (!cur || cur === "about:blank") {
          browser.fixupAndLoadURIString(state.savedUrl, {
            triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
          });
        }
        state.savedUrl = null;
      }
      const tab = win.gBrowser?.selectedTab;
      if (tab && tab.hasAttribute("discarded")) {
        win.gBrowser.reloadTab(tab);
      }
    } catch (e) {}
  }

  static startBrowser(win) {
    const state = this._getState(win);
    state.running = true;
    state.paused = false;

    this._restoreStoppedBrowser(win);
    this._openPip(win);
    this._syncCanvasUI(win);
  }

  static stopBrowser(win) {
    const state = this._getState(win);
    state.running = false;
    state.paused = false;
    this._closePip(win);

    // Save current tab URL and unload/blank tabs to free browser resources
    try {
      const browser = win.gBrowser?.selectedBrowser;
      const curUrl = browser?.currentURI?.spec;
      if (curUrl && curUrl !== "about:blank") {
        state.savedUrl = curUrl;
      }
      if (browser) {
        browser.fixupAndLoadURIString("about:blank", {
          triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
        });
      }
      const tabs = Array.from(win.gBrowser?.tabs || []);
      for (const tab of tabs) {
        if (tab !== win.gBrowser.selectedTab && !tab.pinned) {
          win.gBrowser.discardBrowser(tab, true);
        }
      }
    } catch (e) {}

    this._syncCanvasUI(win);
  }

  static setPaused(win, paused) {
    const state = this._getState(win);
    state.paused = !!paused;
    this._syncCanvasUI(win);
  }

  static onPipClosed(win) {
    const state = this._getState(win);
    if (state.streamTimer) {
      win.clearInterval(state.streamTimer);
      state.streamTimer = null;
    }
    state.pipWindow = null;
  }

  static _syncCanvasUI(win) {
    const state = this._getState(win);
    const doc = win.document;
    const powerBtn = doc.getElementById("desktop-mode-power-btn");
    const statusEl = doc.getElementById("desktop-mode-status");
    if (powerBtn) {
      powerBtn.textContent = state.running ? "Stop Browser" : "Start Browser";
      powerBtn.toggleAttribute("running", state.running);
    }
    if (statusEl) {
      if (!state.running) {
        statusEl.textContent = "Browser stopped — resources freed";
      } else if (state.paused) {
        statusEl.textContent = "Picture-in-Picture paused";
      } else {
        statusEl.textContent = "Browser streaming in Picture-in-Picture";
      }
    }
  }

  static async _renderPipFrame(win) {
    const state = this._getState(win);
    const pipWin = state.pipWindow;
    if (
      !state.active ||
      !state.running ||
      state.paused ||
      state.capturing ||
      !pipWin ||
      pipWin.closed
    ) {
      return;
    }

    const pipDoc = pipWin.document;
    const pipCanvas = pipDoc?.getElementById("pip-stream");
    if (!pipCanvas) {
      return;
    }

    const titleEl = pipDoc.getElementById("pip-title");
    const browser = win.gBrowser?.selectedBrowser;
    if (titleEl && browser) {
      titleEl.textContent =
        win.gBrowser.selectedTab?.label || browser.contentTitle || "Browser";
    }

    state.capturing = true;
    try {
      const winW = Math.max(1, win.innerWidth);
      const winH = Math.max(1, win.innerHeight);

      if (!state.compositeCanvas) {
        state.compositeCanvas = win.document.createElementNS(
          "http://www.w3.org/1999/xhtml",
          "canvas"
        );
      }
      if (
        state.compositeCanvas.width !== winW ||
        state.compositeCanvas.height !== winH
      ) {
        state.compositeCanvas.width = winW;
        state.compositeCanvas.height = winH;
      }

      const compCtx = state.compositeCanvas.getContext("2d");

      // 1. Draw the full browser chrome backdrop (tabs, toolbar, Appbar)
      if (state.chromeCanvas) {
        compCtx.drawImage(state.chromeCanvas, 0, 0, winW, winH);
      } else {
        compCtx.fillStyle = "rgb(19, 18, 21)";
        compCtx.fillRect(0, 0, winW, winH);
      }

      // 2. Composite the live active web tab snapshot at its exact rect
      if (browser) {
        const rect = browser.getBoundingClientRect();
        const wgp = browser.browsingContext?.currentWindowGlobal;
        if (wgp && rect.width > 0 && rect.height > 0) {
          const snap = await wgp.drawSnapshot(null, 1, "rgb(255, 255, 255)");
          if (snap) {
            compCtx.drawImage(snap, rect.left, rect.top, rect.width, rect.height);
            snap.close?.();
          }
        }
      }

      // 3. If an Appbar browser panel is open, composite its live snapshot too
      const appbarBox = win.document.getElementById("appbar-box");
      if (appbarBox && !appbarBox.hidden) {
        const appbarBrowser =
          win.AppbarController?.tabManager?.currentTab?.browser ||
          win.document.getElementById("appbar");
        if (appbarBrowser) {
          const aRect = appbarBrowser.getBoundingClientRect();
          const aWgp = appbarBrowser.browsingContext?.currentWindowGlobal;
          if (aWgp && aRect.width > 0 && aRect.height > 0) {
            const aSnap = await aWgp.drawSnapshot(null, 1, "rgb(19, 18, 21)");
            if (aSnap) {
              compCtx.drawImage(
                aSnap,
                aRect.left,
                aRect.top,
                aRect.width,
                aRect.height
              );
              aSnap.close?.();
            }
          }
        }
      }

      // 4. Copy composite canvas to the PiP window's canvas
      if (pipCanvas.width !== winW || pipCanvas.height !== winH) {
        pipCanvas.width = winW;
        pipCanvas.height = winH;
      }
      const pipCtx = pipCanvas.getContext("2d");
      pipCtx.drawImage(state.compositeCanvas, 0, 0);

      const emptyEl = pipDoc.getElementById("pip-empty");
      if (emptyEl) {
        emptyEl.hidden = true;
      }
    } catch (e) {
    } finally {
      state.capturing = false;
    }
  }

  static _bindPipWindow(win, pipWin) {
    const state = this._getState(win);
    const pipDoc = pipWin.document;
    const overlayEl = pipDoc.getElementById("pip-overlay");
    const badgeEl = pipDoc.getElementById("pip-badge");
    const pauseBtn = pipDoc.getElementById("pip-pause-btn");
    const pauseIcon = pipDoc.getElementById("pip-pause-icon");
    const pauseLabel = pipDoc.getElementById("pip-pause-label");
    const controlBtn = pipDoc.getElementById("pip-control-btn");
    const closeBtn = pipDoc.getElementById("pip-close-btn");

    pauseBtn?.addEventListener("click", () => {
      state.paused = !state.paused;
      overlayEl?.classList.toggle("paused", state.paused);
      if (badgeEl) {
        badgeEl.textContent = state.paused ? "PAUSED" : "LIVE";
        badgeEl.classList.toggle("paused", state.paused);
        badgeEl.classList.toggle("live", !state.paused);
      }
      if (pauseLabel) {
        pauseLabel.textContent = state.paused ? "Resume" : "Pause";
      }
      if (pauseIcon) {
        pauseIcon.src = state.paused
          ? "chrome://global/skin/media/play-fill.svg"
          : "chrome://global/skin/media/pause-fill.svg";
      }
      this._syncCanvasUI(win);
      if (!state.paused) {
        this._renderPipFrame(win);
      }
    });

    controlBtn?.addEventListener("click", () => {
      this.exitToBrowserMode(win);
    });

    closeBtn?.addEventListener("click", () => {
      this.stopBrowser(win);
    });

    pipWin.addEventListener(
      "unload",
      () => {
        this.onPipClosed(win);
      },
      { once: true }
    );

    if (state.streamTimer) {
      win.clearInterval(state.streamTimer);
    }
    this._renderPipFrame(win);
    state.streamTimer = win.setInterval(() => this._renderPipFrame(win), 120);
  }

  static _openPip(win) {
    const state = this._getState(win);
    if (state.pipWindow && !state.pipWindow.closed) {
      state.pipWindow.focus();
      return;
    }

    const width = 520;
    const height = 320;
    const left = Math.max(24, (win.screen?.availWidth || 1280) - width - 32);
    const top = Math.max(24, (win.screen?.availHeight || 800) - height - 64);

    const features =
      `chrome,alwaysontop,resizable,dialog,titlebar=no,` +
      `left=${Math.round(left)},top=${Math.round(top)},` +
      `outerWidth=${width},outerHeight=${height}`;

    const pipWin = Services.ww.openWindow(win, PIP_URI, null, features, null);
    state.pipWindow = pipWin;

    pipWin.addEventListener(
      "load",
      () => {
        this._bindPipWindow(win, pipWin);
      },
      { once: true }
    );
  }

  static _closePip(win) {
    const state = this._getState(win);
    if (state.streamTimer) {
      win.clearInterval(state.streamTimer);
      state.streamTimer = null;
    }
    if (state.pipWindow && !state.pipWindow.closed) {
      try {
        state.pipWindow.close();
      } catch (e) {}
    }
    state.pipWindow = null;
  }
}
