/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { GuardrailPolicy } from "moz-src:///browser/components/oneagent/runtime/GuardrailPolicy.sys.mjs";

export class InternalBrowserAPI {
  static getTabsAPI(window) {
    const gBrowser = window.gBrowser;
    return {
      async list() {
        return Array.from(gBrowser.tabs).map((t, idx) => ({
          id: idx,
          title: t.label,
          url: t.linkedBrowser?.currentURI?.spec || "",
          active: t === gBrowser.selectedTab,
          pinned: t.pinned,
        }));
      },
      async create(url, opts = {}) {
        const tab = gBrowser.addTrustedTab(url, { inBackground: !opts.active });
        return { id: Array.from(gBrowser.tabs).indexOf(tab) };
      },
      async activate(tabId) {
        const tab = gBrowser.tabs[tabId];
        if (tab) {
          gBrowser.selectedTab = tab;
        }
      },
      async close(tabId) {
        const tab = gBrowser.tabs[tabId];
        if (tab) {
          gBrowser.removeTab(tab);
        }
      },
    };
  }

  static getPrefsAPI() {
    return {
      async get(name) {
        GuardrailPolicy.checkPrefAccess(name, false);
        const type = Services.prefs.getPrefType(name);
        switch (type) {
          case Services.prefs.PREF_STRING:
            return Services.prefs.getStringPref(name);
          case Services.prefs.PREF_INT:
            return Services.prefs.getIntPref(name);
          case Services.prefs.PREF_BOOL:
            return Services.prefs.getBoolPref(name);
          default:
            return null;
        }
      },
      async set(name, val) {
        GuardrailPolicy.checkPrefAccess(name, true);
        if (typeof val === "boolean") {
          Services.prefs.setBoolPref(name, val);
        } else if (typeof val === "number") {
          Services.prefs.setIntPref(name, val);
        } else {
          Services.prefs.setStringPref(name, String(val));
        }
      },
      async reset(name) {
        GuardrailPolicy.checkPrefAccess(name, true);
        Services.prefs.clearUserPref(name);
      },
      async search(kw) {
        const branch = Services.prefs.getBranch("");
        const children = branch.getChildList(kw);
        return children.slice(0, 30).map(name => ({
          name,
          value: this.get(name),
        }));
      },
    };
  }

  static getDevToolsAPI(window) {
    return {
      async getConsoleLogs() {
        return [
          { level: "info", text: "OneAgent active session attached to window." },
        ];
      },
      async getNetworkLog(opts = {}) {
        return [];
      },
    };
  }
}
