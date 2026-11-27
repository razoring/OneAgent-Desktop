/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// prettier-ignore
// eslint-disable-next-line no-lone-blocks
{
  Services.scriptloader.loadSubScript("chrome://browser/content/browser-init.js", this);
  Services.scriptloader.loadSubScript("chrome://global/content/contentAreaUtils.js", this);
  Services.scriptloader.loadSubScript("chrome://browser/content/browser-captivePortal.js", this);
  if (AppConstants.MOZ_DATA_REPORTING) {
    Services.scriptloader.loadSubScript("chrome://browser/content/browser-data-submission-info-bar.js", this);
  }
  if (!AppConstants.MOZILLA_OFFICIAL) {
    Services.scriptloader.loadSubScript("chrome://browser/content/browser-development-helpers.js", this);
  }
  Services.scriptloader.loadSubScript("chrome://browser/content/browser-pageActions.js", this);
  Services.scriptloader.loadSubScript("chrome://browser/content/sidebar/browser-sidebar.js", this);
  Services.scriptloader.loadSubScript("chrome://browser/content/sidebar/browser-appbar.js", this);
  Services.scriptloader.loadSubScript("chrome://browser/content/browser-customtitlebar.js", this);
  Services.scriptloader.loadSubScript("chrome://browser/content/browser-unified-extensions.js", this);
  Services.scriptloader.loadSubScript("chrome://browser/content/tabbrowser/drag-and-drop.js", this);
  Services.scriptloader.loadSubScript("chrome://browser/content/tabbrowser/split-view-footer.js", this);
  Services.scriptloader.loadSubScript("chrome://browser/content/tabbrowser/status-panel.js", this);
  ChromeUtils.importESModule("chrome://browser/content/tabbrowser/tab.mjs", { global: "current" });
  Services.scriptloader.loadSubScript("chrome://browser/content/tabbrowser/tab-bar-visibility.js", this);
  Services.scriptloader.loadSubScript("chrome://browser/content/tabbrowser/tab-context-menu.js", this);
  ChromeUtils.importESModule("chrome://browser/content/tabbrowser/tabgroup.mjs", { global: "current" });
  Services.scriptloader.loadSubScript("chrome://browser/content/tabbrowser/tabgroup-menu.js", this);
  Services.scriptloader.loadSubScript("chrome://browser/content/tabbrowser/tabnote-menu.js", this);
  ChromeUtils.importESModule("chrome://browser/content/tabbrowser/tabs.mjs", { global: "current" });
  ChromeUtils.importESModule("chrome://browser/content/tabbrowser/tabsplitview.mjs", { global: "current" });
  Services.scriptloader.loadSubScript("chrome://browser/content/places/places-menupopup.js", this);
  Services.scriptloader.loadSubScript("chrome://browser/content/search/autocomplete-popup.js", this);
  Services.scriptloader.loadSubScript("chrome://browser/content/search/searchbar.js", this);
  if (AIWindow.isOpeningAIWindow(window)) {
    ChromeUtils.importESModule("chrome://browser/content/urlbar/SmartbarInput.mjs", { global: "current" });
  }
  ChromeUtils.importESModule("chrome://browser/content/urlbar/UrlbarInput.mjs", { global: "current" });
  ChromeUtils.importESModule("chrome://browser/content/urlbar/SearchbarInput.mjs", { global: "current" });
  try {
    const { DesktopMode } = ChromeUtils.importESModule("moz-src:///browser/components/oneagent/ui/DesktopMode.sys.mjs");
    window.DesktopMode = DesktopMode;
    if (document.readyState === "complete") {
      DesktopMode.initWindow(window);
    } else {
      window.addEventListener("DOMContentLoaded", () => DesktopMode.initWindow(window), { once: true });
      window.addEventListener("load", () => DesktopMode.initWindow(window), { once: true });
    }
  } catch (e) {
    console.error("Failed to initialize DesktopMode:", e);
  }

  window.addEventListener(
    "load",
    () => {
      const tabbox = document.getElementById("tabbrowser-tabbox");
      if (!tabbox || !window.MousePosTracker) {
        return;
      }
      const PROXIMITY_RADIUS = 46;
      const ANIM_MS = 380;
      let isHovered = false;
      let isOpen = false;
      let animLockUntil = 0;
      const EMPTY_RECT = { top: 0, bottom: 0, left: 0, right: 0 };

      const triggerBtn = document.getElementById("notch-circle-trigger");
      const notchDots = document.getElementById("browser-notch-dots");
      const notchInput = document.getElementById("notch-input");
      const notchSendBtn = document.getElementById("notch-send-btn");

      function openNotch() {
        isOpen = true;
        isHovered = true;
        tabbox.setAttribute("notch-hovered", "true");
        tabbox.setAttribute("notch-open", "true");
        setTimeout(() => notchInput?.focus(), 160);
      }

      function closeNotch() {
        if (!isOpen) {
          return;
        }
        isOpen = false;
        isHovered = false;
        animLockUntil = Date.now() + ANIM_MS;
        tabbox.removeAttribute("notch-open");
        tabbox.removeAttribute("notch-hovered");
        notchInput?.blur();
      }

      triggerBtn?.addEventListener("click", e => {
        e.stopPropagation();
        if (isHovered && !isOpen) {
          openNotch();
        }
      });

      notchSendBtn?.addEventListener("click", () => {
        if (notchInput) {
          notchInput.value = "";
          notchInput.focus();
        }
      });

      notchInput?.addEventListener("keydown", e => {
        if (e.key === "Escape") {
          closeNotch();
        } else if (e.key === "Enter") {
          notchInput.value = "";
        }
      });

      window.addEventListener(
        "mousedown",
        e => {
          if (isOpen && notchDots && !notchDots.contains(e.target)) {
            closeNotch();
          }
        },
        true
      );

      const notchTracker = {
        getMouseTargetRect() {
          if (isOpen) {
            return { top: -1e6, bottom: 1e6, left: -1e6, right: 1e6 };
          }
          if (Date.now() < animLockUntil) {
            return isHovered
              ? { top: -1e6, bottom: 1e6, left: -1e6, right: 1e6 }
              : EMPTY_RECT;
          }
          const rect = tabbox.getBoundingClientRect();
          if (!rect.width || !rect.height) {
            return EMPTY_RECT;
          }
          const cx = rect.left + rect.width / 2;
          if (!isHovered) {
            return {
              left: cx - 29,
              right: cx + 29,
              top: rect.bottom - 23,
              bottom: rect.bottom,
            };
          }
          const cy = rect.bottom - 36;
          const dist = Math.hypot(
            window.MousePosTracker._x - cx,
            window.MousePosTracker._y - cy
          );
          return dist <= PROXIMITY_RADIUS
            ? { top: -1e6, bottom: 1e6, left: -1e6, right: 1e6 }
            : EMPTY_RECT;
        },
        onMouseEnter() {
          if (!isHovered) {
            isHovered = true;
            animLockUntil = Date.now() + ANIM_MS;
            tabbox.setAttribute("notch-hovered", "true");
          }
        },
        onMouseLeave() {
          if (isHovered) {
            isHovered = false;
            animLockUntil = Date.now() + ANIM_MS;
            tabbox.removeAttribute("notch-hovered");
          }
        },
      };

      window.MousePosTracker.addListener(notchTracker);
      window.addEventListener(
        "unload",
        () => window.MousePosTracker?.removeListener(notchTracker),
        { once: true }
      );
    },
    { once: true }
  );
}

window.onload = gBrowserInit.onLoad.bind(gBrowserInit);
window.onunload = gBrowserInit.onUnload.bind(gBrowserInit);
window.onclose = WindowIsClosing;

window.addEventListener(
  "MozBeforeInitialXULLayout",
  gBrowserInit.onBeforeInitialXULLayout.bind(gBrowserInit),
  { once: true }
);

// The listener of DOMContentLoaded must be set on window, rather than
// document, because the window can go away before the event is fired.
// In that case, we don't want to initialize anything, otherwise we
// may be leaking things because they will never be destroyed after.
window.addEventListener(
  "DOMContentLoaded",
  gBrowserInit.onDOMContentLoaded.bind(gBrowserInit),
  { once: true }
);
