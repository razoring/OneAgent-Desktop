/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class AuxEngine {
  static async #fetchChat(messages, maxTokens = 512, json = false) {
    const endpoint = Services.prefs.getStringPref("browser.oneagent.aux.endpoint", "http://127.0.0.1:11434/v1");
    const model = Services.prefs.getStringPref("browser.oneagent.aux.model", "qwen3:1.7b-it");
    const apiKey = Services.prefs.getStringPref("browser.oneagent.aux.apiKey", "");
    const noThink = Services.prefs.getBoolPref("browser.oneagent.aux.noThink", true);

    const formattedMessages = messages.map(m => {
      if (m.role === "system" && noThink && !m.content.startsWith("/no_think")) {
        return { ...m, content: `/no_think ${m.content}` };
      }
      return m;
    });

    const body = {
      model,
      messages: formattedMessages,
      temperature: 0.1,
      max_tokens: maxTokens,
    };
    if (json) {
      body.response_format = { type: "json_object" };
    }

    const headers = { "Content-Type": "application/json" };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const res = await fetch(`${endpoint.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`AuxEngine HTTP ${res.status}: ${await res.text()}`);
    }

    const resJson = await res.json();
    return resJson.choices?.[0]?.message?.content || "";
  }

  static async proposeParameterizedCandidates({ goal, domSnapshot, userSteering }) {
    const prompt = `Goal: "${goal}".
${userSteering ? `User Live Direction: "${userSteering}"` : ""}
DOM interactive elements:
${JSON.stringify(domSnapshot.elements.slice(0, 30))}

Propose 2 to 4 concrete action candidates. Return JSON array:
[{"id": "cand_0", "action": "type"|"click"|"select"|"sliderSet", "ref": "@eX", "value": string|number|null, "label": string}]`;

    const raw = await this.#fetchChat(
      [
        { role: "system", content: "You are a fast UI action parameterizer. Output strictly a JSON array of candidates." },
        { role: "user", content: prompt },
      ],
      256,
      true
    );

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : parsed.candidates || [];
    } catch (e) {
      return [];
    }
  }

  static async summarizeExtractedPages({ query, pages }) {
    const prompt = `User search query: "${query}".
Summarize the following extracted web pages into a concise factual answer with citations:
${pages.map((p, idx) => `[Source ${idx + 1}] (${p.title} - ${p.url}):\n${p.markdown.slice(0, 2000)}`).join("\n\n")}`;

    return this.#fetchChat(
      [
        { role: "system", content: "You are a concise web fact summarizer. Ground facts strictly in sources." },
        { role: "user", content: prompt },
      ],
      800
    );
  }
}
