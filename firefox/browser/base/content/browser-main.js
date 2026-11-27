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
      const notchLeftBtn = document.getElementById("notch-left-btn");
      const notchMenu = document.getElementById("notch-options-menu");
      const notchMenuChat = document.getElementById("notch-menu-switch-to-chat");
      const notchMenuAttach = document.getElementById("notch-menu-attach-files");
      const notchAttachTabsPopup = document.getElementById("notch-attach-tabs-popup");
      const notchPillContent = document.getElementById("notch-pill-content");
      const notchInput = document.getElementById("notch-input");
      const notchSendBtn = document.getElementById("notch-send-btn");

      function insertNotchChip(iconSrc, labelText, tooltipText) {
        if (!notchInput || !labelText) {
          return;
        }
        const chip = document.createElement("span");
        chip.className = "notch-chip";
        chip.contentEditable = "false";
        chip.title = tooltipText || labelText;

        const icon = document.createElement("img");
        icon.src = iconSrc;
        icon.alt = "";

        const name = document.createElement("span");
        name.className = "notch-chip-name";
        name.textContent = labelText;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "notch-chip-remove";
        removeBtn.textContent = "×";
        removeBtn.addEventListener("click", e => {
          e.stopPropagation();
          chip.remove();
          notchInput.focus();
        });

        chip.append(icon, name, removeBtn);

        const sel = window.getSelection();
        const space = document.createTextNode(" ");
        if (sel && sel.rangeCount && notchInput.contains(sel.anchorNode)) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(space);
          range.insertNode(chip);
          range.setStartAfter(space);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          notchInput.append(chip, space);
        }
      }

      function insertFileChip(file) {
        const fileName = file.leafName || file.name;
        if (!fileName) {
          return;
        }
        insertNotchChip(
          "chrome://global/skin/icons/page-portrait.svg",
          fileName,
          file.path || file.mozFullPath || fileName
        );
      }

      function insertTabChip(tab) {
        if (!tab) {
          return;
        }
        const label = tab.label || tab.linkedBrowser?.currentURI?.spec || "Tab";
        const favicon = tab.image || "chrome://global/skin/icons/defaultFavicon.svg";
        const url = tab.linkedBrowser?.currentURI?.spec || label;
        insertNotchChip(favicon, label, url);
      }

      if (notchPillContent) {
        new ResizeObserver(() => {
          const h = Math.max(32, Math.round(notchPillContent.getBoundingClientRect().height));
          tabbox.style.setProperty("--notch-field-h", `${h}px`);
          tabbox.style.setProperty("--notch-pill-h", `${h + 12}px`);
        }).observe(notchPillContent);
      }

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
        tabbox.removeAttribute("notch-dragover");
        notchInput?.blur();
      }

      const TAB_DROP_TYPE = "application/x-moz-tabbrowser-tab";

      function hasDragFiles(e) {
        return Boolean(
          e.dataTransfer?.types?.includes("Files") ||
          e.dataTransfer?.types?.includes(TAB_DROP_TYPE)
        );
      }

      triggerBtn?.addEventListener("dragenter", e => {
        if (hasDragFiles(e) && !isOpen) {
          e.preventDefault();
          openNotch();
        }
      });

      notchPillContent?.addEventListener(
        "dragenter",
        e => {
          if (hasDragFiles(e)) {
            e.preventDefault();
            e.stopPropagation();
            tabbox.setAttribute("notch-dragover", "true");
          }
        },
        true
      );

      notchPillContent?.addEventListener(
        "dragover",
        e => {
          if (hasDragFiles(e)) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "copy";
            tabbox.setAttribute("notch-dragover", "true");
          }
        },
        true
      );

      notchPillContent?.addEventListener("dragleave", e => {
        if (!notchPillContent.contains(e.relatedTarget)) {
          tabbox.removeAttribute("notch-dragover");
        }
      });

      notchPillContent?.addEventListener(
        "drop",
        e => {
          tabbox.removeAttribute("notch-dragover");
          if (!hasDragFiles(e)) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer.types.includes(TAB_DROP_TYPE)) {
            const count = e.dataTransfer.mozItemCount || 0;
            for (let i = 0; i < count; i++) {
              const draggedTab = e.dataTransfer.mozGetDataAt(TAB_DROP_TYPE, i);
              if (draggedTab) {
                insertTabChip(draggedTab);
              }
            }
          }
          if (e.dataTransfer.files?.length) {
            for (const file of e.dataTransfer.files) {
              insertFileChip(file);
            }
          }
          notchInput?.focus();
        },
        true
      );

      triggerBtn?.addEventListener("click", e => {
        e.stopPropagation();
        if (isHovered && !isOpen) {
          openNotch();
        }
      });

      function clearNotchInput() {
        if (notchInput) {
          notchInput.replaceChildren();
        }
      }

      notchSendBtn?.addEventListener("click", () => {
        clearNotchInput();
        notchInput?.focus();
      });

      notchLeftBtn?.addEventListener("click", e => {
        e.stopPropagation();
        if (notchMenu) {
          if (notchMenu.state === "open") {
            notchMenu.hidePopup();
          } else {
            notchMenu.openPopup(notchLeftBtn, "before_start", 0, -6, false, false);
          }
        }
      });

      notchMenuChat?.addEventListener("command", () => {
        closeNotch();
        window.DesktopMode?.toggle(window);
      });

      notchAttachTabsPopup?.addEventListener("popupshowing", () => {
        notchAttachTabsPopup.replaceChildren();
        for (const tab of window.gBrowser?.tabs || []) {
          const item = document.createXULElement("menuitem");
          item.className = "menuitem-iconic";
          item.setAttribute("label", tab.label || tab.linkedBrowser?.currentURI?.spec || "Tab");
          item.setAttribute(
            "image",
            tab.image || "chrome://global/skin/icons/defaultFavicon.svg"
          );
          item.addEventListener("command", () => {
            insertTabChip(tab);
            notchInput?.focus();
          });
          notchAttachTabsPopup.appendChild(item);
        }
      });

      notchMenuAttach?.addEventListener("command", () => {
        try {
          const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
          fp.init(window.browsingContext, "Attach files", Ci.nsIFilePicker.modeOpenMultiple);
          fp.open(rv => {
            if (rv === Ci.nsIFilePicker.returnOK) {
              for (const file of fp.files) {
                insertFileChip(file);
              }
              notchInput?.focus();
            }
          });
        } catch (err) {
          console.error("Attach files error:", err);
        }
      });

      function applyInlineMarkdown() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || !sel.isCollapsed) {
          return;
        }
        const node = sel.anchorNode;
        if (!node || node.nodeType !== Node.TEXT_NODE || !notchInput?.contains(node)) {
          return;
        }
        const offset = sel.anchorOffset;
        const text = node.textContent.slice(0, offset);
        const rules = [
          { re: /^[-*]\s$/, cmd: "insertUnorderedList", len: 2 },
          { re: /^1\.\s$/, cmd: "insertOrderedList", len: 3 },
          { re: /\*\*([^*\n]+)\*\*$/, tag: "strong" },
          { re: /__([^_\n]+)__$/, tag: "strong" },
          { re: /~~([^~\n]+)~~$/, tag: "s" },
          { re: /\+\+([^+\n]+)\+\+$/, tag: "u" },
          { re: /(?:^|[^*])\*([^*\n]+)\*$/, tag: "em", keepPrefix: true },
          { re: /(?:^|[^_])_([^_\n]+)_$/, tag: "em", keepPrefix: true },
        ];
        for (const rule of rules) {
          const m = text.match(rule.re);
          if (!m) {
            continue;
          }
          if (rule.cmd) {
            const r = document.createRange();
            r.setStart(node, 0);
            r.setEnd(node, rule.len);
            sel.removeAllRanges();
            sel.addRange(r);
            document.execCommand("delete");
            document.execCommand(rule.cmd);
            return;
          }
          const full = m[0];
          const inner = m[1];
          const prefixLen = rule.keepPrefix && full.length > inner.length + 2 ? 1 : 0;
          const start = offset - full.length + prefixLen;
          const r = document.createRange();
          r.setStart(node, start);
          r.setEnd(node, offset);
          r.deleteContents();
          const el = document.createElement(rule.tag);
          el.textContent = inner;
          r.insertNode(el);
          const space = document.createTextNode("\u200B");
          el.after(space);
          const after = document.createRange();
          after.setStartAfter(space);
          after.collapse(true);
          sel.removeAllRanges();
          sel.addRange(after);
          return;
        }
      }

      notchInput?.addEventListener("input", () => applyInlineMarkdown());

      notchInput?.addEventListener("keydown", e => {
        if (e.key === "Escape") {
          closeNotch();
        } else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          clearNotchInput();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "u") {
          e.preventDefault();
          document.execCommand("underline");
        }
      });

      window.addEventListener(
        "mousedown",
        e => {
          if (
            isOpen &&
            notchDots &&
            !notchDots.contains(e.target) &&
            (!notchMenu || (!notchMenu.contains(e.target) && notchMenu.state !== "open"))
          ) {
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
