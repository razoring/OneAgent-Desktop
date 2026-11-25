/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class LocalDecisionAdapter {
  static async evaluate(request) {
    const endpoint = Services.prefs.getStringPref("browser.oneagent.aux.endpoint", "http://127.0.0.1:11434/v1");
    const model = Services.prefs.getStringPref("browser.oneagent.aux.model", "qwen3:1.7b-it");
    const apiKey = Services.prefs.getStringPref("browser.oneagent.aux.apiKey", "");

    const url = `${endpoint.replace(/\/+$/, "")}/chat/completions`;
    const systemPrompt =
      "/no_think You are a deterministic policy evaluator. Given input state and questions, output strictly JSON with zero prose.";

    const userPrompt = JSON.stringify({
      goal: request.input.goal,
      url: request.input.url,
      last_actions: request.input.last_actions,
      user_steering: request.input.user_steering || null,
      dom_snapshot: request.input.dom_snapshot,
      questions: request.questions,
    });

    const body = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Evaluate decisions:\n${userPrompt}\nOutput format: {"decisions": { "<question_id>": { "selection": string, "confidence": number } } }` },
      ],
      temperature: 0,
      max_tokens: 256,
      response_format: { type: "json_object" },
    };

    const headers = { "Content-Type": "application/json" };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`LocalDecisionAdapter HTTP ${res.status}: ${await res.text()}`);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    return parsed.decisions || parsed;
  }
}
