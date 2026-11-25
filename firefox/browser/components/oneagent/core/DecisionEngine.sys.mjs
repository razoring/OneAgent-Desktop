/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { LocalDecisionAdapter } from "moz-src:///browser/components/oneagent/core/LocalDecisionAdapter.sys.mjs";

export class DecisionEngine {
  static async evaluate(decisionRequest) {
    const mode = Services.prefs.getStringPref("browser.oneagent.decision.mode", "local-adapter");

    if (mode === "local-adapter") {
      return LocalDecisionAdapter.evaluate(decisionRequest);
    }

    const endpoint = Services.prefs.getStringPref(
      "browser.oneagent.decision.endpoint",
      "https://api.openai.com/v1/decisions"
    );
    const apiKey = Services.prefs.getStringPref("browser.oneagent.decision.apiKey", "");
    const model = Services.prefs.getStringPref("browser.oneagent.decision.model", "gpt-6-luna-decision");

    const payload = {
      model,
      input: decisionRequest.input,
      questions: decisionRequest.questions,
    };

    const headers = { "Content-Type": "application/json" };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`DecisionEngine HTTP ${response.status}: ${await response.text()}`);
    }

    const resJson = await response.json();
    return resJson.decisions || resJson;
  }
}
