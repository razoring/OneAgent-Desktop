/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class OneAgentContentParent extends JSWindowActorParent {
  async observePage(options = {}) {
    return this.sendQuery("ObservePage", options);
  }

  async executeAction(actionData) {
    return this.sendQuery("ExecuteAction", actionData);
  }

  async evaluateScript(script, args = []) {
    return this.sendQuery("EvaluateScript", { script, args });
  }

  async blindFill(credentials) {
    return this.sendQuery("BlindFill", credentials);
  }

  async extractMarkdown() {
    return this.sendQuery("ExtractMarkdown");
  }

  receiveMessage(message) {
    switch (message.name) {
      case "OneAgent:HighlightTarget": {
        const browser = this.browsingContext?.top?.embedderElement;
        const win = browser?.ownerGlobal;
        if (win && win.OneAgentTabOverlayManager) {
          win.OneAgentTabOverlayManager.highlightTarget(browser, message.data);
        }
        break;
      }
    }
  }
}
