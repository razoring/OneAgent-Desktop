/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { TypeStubRouter } from "moz-src:///browser/components/oneagent/core/TypeStubRouter.sys.mjs";

export class BrainEngine {
  static get TOOLS() {
    return [
      {
        type: "function",
        function: {
          name: "browser_exec",
          description:
            "Executes JavaScript in the Gecko Browser Sandbox with access to `page.*`, `browser.*` (tabs, prefs, devtools, auth, search), and `$stash`.",
          parameters: {
            type: "object",
            properties: {
              code: { type: "string", description: "Async JavaScript code to evaluate." },
              description: { type: "string", description: "Brief summary of the action." },
            },
            required: ["code"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "system_exec",
          description:
            "Executes JavaScript in the Host System Sandbox with access to `fs.*`, `shell.*`, `mcp.*`, `skills.*`, `memory.*`, `cron.*`, and `$stash`.",
          parameters: {
            type: "object",
            properties: {
              code: { type: "string", description: "Async JavaScript code to evaluate." },
              description: { type: "string", description: "Brief summary of the action." },
            },
            required: ["code"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "ui_delegate",
          description:
            "Delegates interactive multi-step web navigation to the fast sub-100ms System 1 Decision/Aux loop.",
          parameters: {
            type: "object",
            properties: {
              goal: { type: "string", description: "Clear sub-goal to achieve on current page." },
              checkpoints: {
                type: "array",
                items: { type: "string" },
                description: "Success conditions that signal completion.",
              },
              maxSteps: { type: "integer", description: "Maximum micro-steps before returning (default 10)." },
            },
            required: ["goal"],
          },
        },
      },
    ];
  }

  static async runTurn({ messages, signal, onDelta }) {
    const endpoint = Services.prefs.getStringPref("browser.oneagent.brain.endpoint", "http://127.0.0.1:11434/v1");
    const model = Services.prefs.getStringPref("browser.oneagent.brain.model", "glm-4.7-flash:30b-a3b");
    const apiKey = Services.prefs.getStringPref("browser.oneagent.brain.apiKey", "");
    const temperature = parseFloat(Services.prefs.getStringPref("browser.oneagent.brain.temperature", "0.2"));
    const maxTokens = Services.prefs.getIntPref("browser.oneagent.brain.maxTokens", 4096);

    const typeStubs = TypeStubRouter.getDeclarations();
    const systemMessage = {
      role: "system",
      content: `You are OneAgent, a powerful AI automation system embedded directly into the browser.
You have two execution tools:
1. \`browser_exec\`: Controls browser DOM, tabs, prefs, devtools, auth autofill, and silent search.
2. \`system_exec\`: Controls host filesystem, OS commands, MCP servers, memory, and scheduled cron jobs.
3. \`ui_delegate\`: Hands over rapid multi-step UI clicks and form fills to the fast System 1 loop.
You share state across executions using \`$stash.set(k, v)\` and \`$stash.get(k)\`.

Available JavaScript APIs:
${typeStubs}

Be efficient. When a goal requires multiple steps, write robust async JavaScript or use \`ui_delegate\`.`,
    };

    const fullMessages = [systemMessage, ...messages];

    const body = {
      model,
      messages: fullMessages,
      tools: this.TOOLS,
      tool_choice: "auto",
      temperature,
      max_tokens: maxTokens,
      stream: typeof onDelta === "function",
    };

    const headers = { "Content-Type": "application/json" };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${endpoint.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      throw new Error(`BrainEngine HTTP ${response.status}: ${await response.text()}`);
    }

    if (body.stream && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let aggregatedContent = "";
      let aggregatedToolCalls = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) {
            continue;
          }
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === "[DONE]") {
            continue;
          }
          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) {
              continue;
            }
            if (delta.content) {
              aggregatedContent += delta.content;
              onDelta(delta.content);
            }
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!aggregatedToolCalls[idx]) {
                  aggregatedToolCalls[idx] = {
                    id: tc.id || `call_${idx}_${Date.now()}`,
                    type: "function",
                    function: { name: "", arguments: "" },
                  };
                }
                if (tc.id) {
                  aggregatedToolCalls[idx].id = tc.id;
                }
                if (tc.function?.name) {
                  aggregatedToolCalls[idx].function.name += tc.function.name;
                }
                if (tc.function?.arguments) {
                  aggregatedToolCalls[idx].function.arguments += tc.function.arguments;
                }
              }
            }
          } catch (e) {
            // Ignore parse errors on incomplete chunk
          }
        }
      }

      return {
        role: "assistant",
        content: aggregatedContent,
        tool_calls: aggregatedToolCalls.length > 0 ? aggregatedToolCalls : undefined,
      };
    }

    const resJson = await response.json();
    const message = resJson.choices?.[0]?.message;
    return message;
  }
}
