/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { SharedStash } from "moz-src:///browser/components/oneagent/runtime/SharedStash.sys.mjs";
import { InternalBrowserAPI } from "moz-src:///browser/components/oneagent/services/InternalBrowserAPI.sys.mjs";
import { BlindCredentialBroker } from "moz-src:///browser/components/oneagent/services/BlindCredentialBroker.sys.mjs";
import { BackgroundSearch } from "moz-src:///browser/components/oneagent/services/BackgroundSearch.sys.mjs";

export class BrowserSandbox {
  static async execute(code, window) {
    const tab = window.gBrowser?.selectedTab;
    const browser = tab?.linkedBrowser;
    const actor = browser?.browsingContext?.currentWindowGlobal?.getActor("OneAgentContent");

    const pageFacade = {
      observe: opts => (actor ? actor.observePage(opts) : Promise.reject(new Error("No tab actor"))),
      click: ref => (actor ? actor.executeAction({ action: "click", ref }) : Promise.reject(new Error("No tab actor"))),
      type: (ref, text, opts) => (actor ? actor.executeAction({ action: "type", ref, value: text, options: opts }) : Promise.reject(new Error("No tab actor"))),
      sliderSet: (ref, val) => (actor ? actor.executeAction({ action: "sliderSet", ref, value: val }) : Promise.reject(new Error("No tab actor"))),
      scroll: dir => (actor ? actor.executeAction({ action: "scroll", value: dir }) : Promise.reject(new Error("No tab actor"))),
      evaluate: (fn, ...args) => (actor ? actor.evaluateScript(fn.toString(), args) : Promise.reject(new Error("No tab actor"))),
      extractMarkdown: () => (actor ? actor.extractMarkdown() : Promise.reject(new Error("No tab actor"))),
    };

    const browserFacade = {
      tabs: InternalBrowserAPI.getTabsAPI(window),
      prefs: InternalBrowserAPI.getPrefsAPI(),
      devtools: InternalBrowserAPI.getDevToolsAPI(window),
      auth: BlindCredentialBroker.getAuthAPI(window),
      search: {
        query: q => BackgroundSearch.query(q),
        extractUrl: u => BackgroundSearch.extractUrl(u),
      },
    };

    const sandbox = Cu.Sandbox(Services.scriptSecurityManager.createNullPrincipal({}), {
      wantComponents: false,
      wantGlobalProperties: ["URL", "URLSearchParams", "TextEncoder", "TextDecoder", "crypto", "structuredClone"],
    });

    sandbox.page = Cu.cloneInto(pageFacade, sandbox, { cloneFunctions: true });
    sandbox.browser = Cu.cloneInto(browserFacade, sandbox, { cloneFunctions: true });
    sandbox.$stash = Cu.cloneInto(SharedStash, sandbox, { cloneFunctions: true });

    try {
      const wrappedScript = `(async () => { "use strict"; ${code} })()`;
      const result = await Cu.evalInSandbox(wrappedScript, sandbox);
      return result !== undefined ? structuredClone(result) : null;
    } catch (err) {
      return { error: err.message, stack: err.stack };
    } finally {
      Cu.nukeSandbox(sandbox);
    }
  }
}
