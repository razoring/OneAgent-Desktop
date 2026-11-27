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
      const notchMentionMenuPopup = document.getElementById("notch-mention-menu-popup");
      const notchMentionPopup = document.getElementById("notch-mention-popup");
      const notchResponse = document.getElementById("notch-response");
      const notchPillContent = document.getElementById("notch-pill-content");
      const notchInput = document.getElementById("notch-input");
      const notchSendBtn = document.getElementById("notch-send-btn");
      const pastAttachments = new Map();

      function createChipElement(iconSrc, labelText, tooltipText, onRemove) {
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

        chip.append(icon, name);
        if (onRemove) {
          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "notch-chip-remove";
          removeBtn.textContent = "×";
          removeBtn.addEventListener("click", e => {
            e.stopPropagation();
            onRemove(chip);
          });
          chip.append(removeBtn);
        }
        return chip;
      }

      function insertNotchChip(iconSrc, labelText, tooltipText, isMention = false, replaceRange = null) {
        if (!notchInput || !labelText) {
          return;
        }
        if (!isMention) {
          pastAttachments.set(labelText, {
            name: labelText,
            iconSrc,
            tooltip: tooltipText || labelText,
          });
        }
        const chip = createChipElement(iconSrc, labelText, tooltipText, el => {
          el.remove();
          notchInput.focus();
        });

        const sel = window.getSelection();
        const space = document.createTextNode(" ");
        const range =
          replaceRange ||
          (sel && sel.rangeCount && notchInput.contains(sel.anchorNode) ? sel.getRangeAt(0) : null);
        if (range) {
          range.deleteContents();
          range.insertNode(space);
          range.insertNode(chip);
          range.setStartAfter(space);
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
        } else {
          notchInput.append(chip, space);
        }
      }

      function insertMentionChip(att, replaceRange = null) {
        insertNotchChip(att.iconSrc, `@${att.name}`, att.tooltip, true, replaceRange);
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

      function renderLatex(tex, displayMode = false) {
        const LATEX_SYMS = {
          alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", theta: "θ",
          lambda: "λ", mu: "μ", pi: "π", sigma: "σ", phi: "φ", omega: "ω",
          Delta: "Δ", Sigma: "Σ", Omega: "Ω", sum: "∑", prod: "∏", int: "∫",
          infty: "∞", pm: "±", times: "×", cdot: "·", div: "÷", neq: "≠",
          leq: "≤", geq: "≥", approx: "≈", to: "→", rightarrow: "→",
          leftarrow: "←", partial: "∂", nabla: "∇", forall: "∀", exists: "∃",
        };
        function readGroup(str, i) {
          while (i < str.length && str[i] === " ") {
            i++;
          }
          if (str[i] !== "{") {
            return [str[i] || "", i + 1];
          }
          let depth = 0;
          const start = ++i;
          while (i < str.length) {
            if (str[i] === "{") {
              depth++;
            } else if (str[i] === "}") {
              if (depth === 0) {
                return [str.slice(start, i), i + 1];
              }
              depth--;
            }
            i++;
          }
          return [str.slice(start), i];
        }
        function parseNodes(str) {
          const frag = document.createDocumentFragment();
          let i = 0;
          while (i < str.length) {
            if (str.startsWith("\\frac", i)) {
              const [num, i1] = readGroup(str, i + 5);
              const [den, i2] = readGroup(str, i1);
              const frac = document.createElement("span");
              frac.className = "notch-frac";
              const nEl = document.createElement("span");
              nEl.className = "notch-frac-num";
              nEl.append(parseNodes(num));
              const dEl = document.createElement("span");
              dEl.className = "notch-frac-den";
              dEl.append(parseNodes(den));
              frac.append(nEl, dEl);
              frag.append(frac);
              i = i2;
            } else if (str.startsWith("\\sqrt", i)) {
              const [body, i1] = readGroup(str, i + 5);
              const wrap = document.createElement("span");
              wrap.className = "notch-sqrt";
              wrap.append("√");
              const bEl = document.createElement("span");
              bEl.className = "notch-sqrt-body";
              bEl.append(parseNodes(body));
              wrap.append(bEl);
              frag.append(wrap);
              i = i1;
            } else if (str[i] === "^" || str[i] === "_") {
              const tag = str[i] === "^" ? "sup" : "sub";
              const [grp, i1] = readGroup(str, i + 1);
              const el = document.createElement(tag);
              el.append(parseNodes(grp));
              frag.append(el);
              i = i1;
            } else if (str[i] === "\\") {
              const m = str.slice(i + 1).match(/^[A-Za-z]+/);
              if (m) {
                frag.append(LATEX_SYMS[m[0]] || m[0]);
                i += 1 + m[0].length;
              } else {
                frag.append(str[i + 1] || "");
                i += 2;
              }
            } else if (str[i] === "{" || str[i] === "}") {
              i++;
            } else {
              frag.append(str[i++]);
            }
          }
          return frag;
        }
        const container = document.createElement(displayMode ? "div" : "span");
        container.className = displayMode ? "notch-math-block" : "notch-math-inline";
        container.append(parseNodes(tex.trim()));
        return container;
      }

      function renderInlineRich(text, chipMap) {
        const frag = document.createDocumentFragment();
        const tokenRe = /(\[\[chip:([^\]]+)\]\]|\*\*([^*\n]+)\*\*|~~([^~\n]+)~~|\+\+([^+\n]+)\+\+|`([^`\n]+)`|\[([^\]]+)\]\(([^)]+)\)|\\\((.+?)\\\)|\$([^$\n]+)\$|\*([^*\n]+)\*)/g;
        let last = 0;
        for (const m of text.matchAll(tokenRe)) {
          if (m.index > last) {
            frag.append(text.slice(last, m.index));
          }
          if (m[2] !== undefined) {
            const c = chipMap.get(m[2]) || {
              iconSrc: "chrome://global/skin/icons/page-portrait.svg",
              name: m[2],
              tooltip: m[2],
            };
            frag.append(createChipElement(c.iconSrc, c.name, c.tooltip));
          } else if (m[3] !== undefined) {
            const el = document.createElement("strong");
            el.textContent = m[3];
            frag.append(el);
          } else if (m[4] !== undefined) {
            const el = document.createElement("s");
            el.textContent = m[4];
            frag.append(el);
          } else if (m[5] !== undefined) {
            const el = document.createElement("u");
            el.textContent = m[5];
            frag.append(el);
          } else if (m[6] !== undefined) {
            const el = document.createElement("code");
            el.textContent = m[6];
            frag.append(el);
          } else if (m[7] !== undefined) {
            const a = document.createElement("a");
            a.textContent = m[7];
            a.href = m[8];
            frag.append(a);
          } else if (m[9] !== undefined || m[10] !== undefined) {
            frag.append(renderLatex(m[9] ?? m[10], false));
          } else if (m[11] !== undefined) {
            const el = document.createElement("em");
            el.textContent = m[11];
            frag.append(el);
          }
          last = m.index + m[0].length;
        }
        if (last < text.length) {
          frag.append(text.slice(last));
        }
        return frag;
      }

      function renderMockResponse(mdText, chipMap) {
        if (!notchResponse) {
          return;
        }
        notchResponse.replaceChildren();
        const header = document.createElement("div");
        header.className = "notch-response-header";
        const title = document.createElement("span");
        title.textContent = "Response Preview";
        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "notch-response-close";
        closeBtn.textContent = "×";
        closeBtn.addEventListener("click", () => {
          notchResponse.hidden = true;
          notchResponse.replaceChildren();
        });
        header.append(title, closeBtn);
        notchResponse.append(header);

        const lines = mdText.split("\n");
        let listEl = null;
        let listTag = null;
        let i = 0;
        function flushList() {
          if (listEl) {
            notchResponse.append(listEl);
            listEl = null;
            listTag = null;
          }
        }
        while (i < lines.length) {
          const line = lines[i];
          if (line.startsWith("```")) {
            flushList();
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].startsWith("```")) {
              codeLines.push(lines[i++]);
            }
            const pre = document.createElement("pre");
            const code = document.createElement("code");
            code.textContent = codeLines.join("\n");
            pre.append(code);
            notchResponse.append(pre);
            i++;
            continue;
          }
          if (line.trim().startsWith("$$") || line.trim().startsWith("\\[")) {
            flushList();
            const endTok = line.trim().startsWith("$$") ? "$$" : "\\]";
            let expr = line.trim().slice(2);
            if (expr.endsWith(endTok)) {
              expr = expr.slice(0, -2);
            } else {
              i++;
              while (i < lines.length && !lines[i].includes(endTok)) {
                expr += " " + lines[i++];
              }
              if (i < lines.length) {
                expr += " " + lines[i].replace(endTok, "");
              }
            }
            notchResponse.append(renderLatex(expr, true));
            i++;
            continue;
          }
          const hMatch = line.match(/^(#{1,3})\s+(.+)$/);
          if (hMatch) {
            flushList();
            const h = document.createElement(`h${hMatch[1].length}`);
            h.append(renderInlineRich(hMatch[2], chipMap));
            notchResponse.append(h);
            i++;
            continue;
          }
          const ulMatch = line.match(/^[-*]\s+(.+)$/);
          const olMatch = line.match(/^\d+\.\s+(.+)$/);
          if (ulMatch || olMatch) {
            const tag = ulMatch ? "ul" : "ol";
            if (listTag !== tag) {
              flushList();
              listEl = document.createElement(tag);
              listTag = tag;
            }
            const li = document.createElement("li");
            li.append(renderInlineRich((ulMatch || olMatch)[1], chipMap));
            listEl.append(li);
            i++;
            continue;
          }
          flushList();
          if (line.startsWith("> ")) {
            const bq = document.createElement("blockquote");
            bq.append(renderInlineRich(line.slice(2), chipMap));
            notchResponse.append(bq);
          } else if (line.trim()) {
            const p = document.createElement("p");
            p.append(renderInlineRich(line, chipMap));
            notchResponse.append(p);
          }
          i++;
        }
        flushList();
        notchResponse.hidden = false;
      }

      function sendNotchPrompt() {
        if (!notchInput) {
          return;
        }
        const chipMap = new Map();
        const usedChips = [];
        for (const el of notchInput.querySelectorAll(".notch-chip")) {
          const name = el.querySelector(".notch-chip-name")?.textContent || "";
          const iconSrc = el.querySelector("img")?.getAttribute("src") || "chrome://global/skin/icons/page-portrait.svg";
          if (name) {
            chipMap.set(name, { name, iconSrc, tooltip: el.title || name });
            usedChips.push(name);
          }
        }
        const rawPrompt = notchInput.textContent.replace(/\u200B/g, "").trim();
        if (!rawPrompt && !usedChips.length) {
          return;
        }
        if (!usedChips.length) {
          const tab = window.gBrowser?.selectedTab;
          const tabName = tab?.label || "Active Tab";
          chipMap.set(tabName, {
            name: tabName,
            iconSrc: tab?.image || "chrome://global/skin/icons/defaultFavicon.svg",
            tooltip: tab?.linkedBrowser?.currentURI?.spec || tabName,
          });
          usedChips.push(tabName);
        }
        const chipTokens = usedChips.map(n => `[[chip:${n}]]`).join(" ");
        const mockMd = [
          "### Summary",
          `Analyzed ${chipTokens} for **${rawPrompt || "your request"}** with *inline* ++formatting++ and \`code\`.`,
          "- Supports **bold**, *italic*, ~~strike~~, and inline chips",
          "- Supports inline math like $E = mc^2$ and $\\alpha + \\beta \\approx \\pi$",
          "$$\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$",
        ].join("\n");
        notchMentionPopup?.hidePopup();
        clearNotchInput();
        renderMockResponse(mockMd, chipMap);
        notchInput.focus();
      }

      notchSendBtn?.addEventListener("click", () => {
        sendNotchPrompt();
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

      notchMentionMenuPopup?.addEventListener("popupshowing", () => {
        notchMentionMenuPopup.replaceChildren();
        if (!pastAttachments.size) {
          const empty = document.createXULElement("menuitem");
          empty.setAttribute("label", "No past attachments");
          empty.setAttribute("disabled", "true");
          notchMentionMenuPopup.appendChild(empty);
          return;
        }
        for (const att of pastAttachments.values()) {
          const item = document.createXULElement("menuitem");
          item.className = "menuitem-iconic";
          item.setAttribute("label", `@${att.name}`);
          item.setAttribute("image", att.iconSrc);
          item.addEventListener("command", () => {
            insertMentionChip(att);
            notchInput?.focus();
          });
          notchMentionMenuPopup.appendChild(item);
        }
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

      function updateMentionAutocomplete() {
        if (!notchMentionPopup || !notchInput || !pastAttachments.size) {
          notchMentionPopup?.hidePopup();
          return;
        }
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || !sel.isCollapsed) {
          notchMentionPopup.hidePopup();
          return;
        }
        const node = sel.anchorNode;
        if (!node || node.nodeType !== Node.TEXT_NODE || !notchInput.contains(node)) {
          notchMentionPopup.hidePopup();
          return;
        }
        const offset = sel.anchorOffset;
        const before = node.textContent.slice(0, offset);
        const m = before.match(/(?:^|\s)@([^\s@]*)$/);
        if (!m) {
          notchMentionPopup.hidePopup();
          return;
        }
        const query = m[1].toLowerCase();
        const matches = [...pastAttachments.values()].filter(att =>
          att.name.toLowerCase().includes(query)
        );
        if (!matches.length) {
          notchMentionPopup.hidePopup();
          return;
        }
        const atStart = offset - m[1].length - 1;
        notchMentionPopup.replaceChildren();
        for (const att of matches) {
          const item = document.createXULElement("menuitem");
          item.className = "menuitem-iconic";
          item.setAttribute("label", `@${att.name}`);
          item.setAttribute("image", att.iconSrc);
          item.addEventListener("command", () => {
            const replaceRange = document.createRange();
            replaceRange.setStart(node, atStart);
            replaceRange.setEnd(node, offset);
            insertMentionChip(att, replaceRange);
            notchInput.focus();
          });
          notchMentionPopup.appendChild(item);
        }
        if (notchMentionPopup.state !== "open") {
          notchMentionPopup.openPopup(notchInput, "before_start", 0, -6, false, false);
        }
      }

      notchInput?.addEventListener("input", () => {
        applyInlineMarkdown();
        updateMentionAutocomplete();
      });

      notchInput?.addEventListener("keydown", e => {
        if (e.key === "Escape") {
          if (notchMentionPopup?.state === "open") {
            notchMentionPopup.hidePopup();
          } else {
            closeNotch();
          }
        } else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendNotchPrompt();
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
            (!notchMenu || (!notchMenu.contains(e.target) && notchMenu.state !== "open")) &&
            (!notchMentionPopup ||
              (!notchMentionPopup.contains(e.target) && notchMentionPopup.state !== "open"))
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
