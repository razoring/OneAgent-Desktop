/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { AuxEngine } from "moz-src:///browser/components/oneagent/core/AuxEngine.sys.mjs";

export class BackgroundSearch {
  static async query(query) {
    const provider = Services.prefs.getStringPref("browser.oneagent.search.provider", "auto-background");
    const maxPages = Services.prefs.getIntPref("browser.oneagent.search.maxPages", 3);

    // Fast HTTP SERP retrieval via DuckDuckGo Lite
    const serpUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const serpRes = await fetch(serpUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const serpText = await serpRes.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(serpText, "text/html");
    const links = Array.from(doc.querySelectorAll(".result__snippet, .result__url"));
    const anchorElements = Array.from(doc.querySelectorAll("a.result__url, a.result__snippet"));

    const targets = [];
    for (const a of anchorElements) {
      const href = a.getAttribute("href");
      if (href && !href.startsWith("/") && href.startsWith("http")) {
        if (!targets.some(t => t.url === href)) {
          targets.push({ title: a.innerText || href, url: href });
        }
      }
      if (targets.length >= maxPages) {
        break;
      }
    }

    if (targets.length === 0) {
      return { digest: "No organic search results found.", sources: [] };
    }

    // Parallel background extraction
    const extractedPages = await Promise.all(
      targets.map(async t => {
        try {
          const res = await this.extractUrl(t.url);
          return { title: t.title, url: t.url, markdown: res.markdown };
        } catch (e) {
          return { title: t.title, url: t.url, markdown: "" };
        }
      })
    );

    const validPages = extractedPages.filter(p => p.markdown.length > 50);
    const digest = await AuxEngine.summarizeExtractedPages({ query, pages: validPages });

    return {
      digest,
      sources: validPages.map(p => ({ title: p.title, url: p.url })),
    };
  }

  static async extractUrl(url) {
    // Fast Tier 1 fetch
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const htmlText = await res.text();
      const doc = new DOMParser().parseFromString(htmlText, "text/html");
      const main = doc.querySelector("main, article") || doc.body;
      const text = main ? main.innerText.trim() : "";
      if (text.length >= 300) {
        return { title: doc.title || url, markdown: text.slice(0, 10000) };
      }
    } catch (e) {}

    // Tier 2: Hidden windowless browser for JS-heavy pages
    return this.#extractViaHiddenBrowser(url);
  }

  static #extractViaHiddenBrowser(url) {
    return new Promise((resolve, reject) => {
      const hiddenDoc = Services.appShell.hiddenDOMWindow.document;
      const hiddenBrowser = hiddenDoc.createXULElement("browser");
      hiddenBrowser.setAttribute("type", "content");
      hiddenBrowser.setAttribute("remote", "true");
      hiddenBrowser.setAttribute("nodefaultsrc", "true");
      hiddenBrowser.setAttribute("style", "width: 1280px; height: 800px; visibility: collapse;");

      const cleanup = () => {
        try {
          hiddenBrowser.remove();
        } catch (e) {}
      };

      const timeoutId = Services.appShell.hiddenDOMWindow.setTimeout(() => {
        cleanup();
        resolve({ title: url, markdown: "" });
      }, 10000);

      hiddenBrowser.addEventListener(
        "DOMContentLoaded",
        async () => {
          Services.appShell.hiddenDOMWindow.clearTimeout(timeoutId);
          try {
            const actor = hiddenBrowser.browsingContext?.currentWindowGlobal?.getActor("OneAgentContent");
            const result = actor ? await actor.extractMarkdown() : { title: url, markdown: "" };
            cleanup();
            resolve(result);
          } catch (err) {
            cleanup();
            resolve({ title: url, markdown: "" });
          }
        },
        { once: true }
      );

      hiddenDoc.documentElement.appendChild(hiddenBrowser);
      hiddenBrowser.setAttribute("src", url);
    });
  }
}
