/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class BlindCredentialBroker {
  static getAuthAPI(window) {
    return {
      async hasSavedLogin() {
        const tab = window.gBrowser?.selectedTab;
        const uri = tab?.linkedBrowser?.currentURI;
        if (!uri || !uri.prePath) {
          return { available: false, origin: "", count: 0 };
        }
        const origin = uri.prePath;
        try {
          const count = await Services.logins.countLoginsAsync(origin, "", null);
          return { available: count > 0, origin, count };
        } catch (e) {
          return { available: false, origin, count: 0 };
        }
      },

      async autofillCurrentTab(opts = {}) {
        const tab = window.gBrowser?.selectedTab;
        const browser = tab?.linkedBrowser;
        const uri = browser?.currentURI;
        if (!uri || !uri.prePath) {
          return { filled: false, submitted: false, reason: "No active URI" };
        }

        const origin = uri.prePath;
        const logins = await Services.logins.searchLoginsAsync({ origin });
        if (!logins || logins.length === 0) {
          return { filled: false, submitted: false, reason: "No saved login for origin" };
        }

        const primaryLogin = logins[0];
        const actor = browser.browsingContext?.currentWindowGlobal?.getActor("OneAgentContent");
        if (!actor) {
          return { filled: false, submitted: false, reason: "Actor unavailable" };
        }

        return actor.blindFill({
          username: primaryLogin.username,
          password: primaryLogin.password,
          submit: !!opts.submit,
        });
      },
    };
  }
}
