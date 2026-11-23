/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { BrainEngine } from "moz-src:///browser/components/oneagent/core/BrainEngine.sys.mjs";
import { AuxEngine } from "moz-src:///browser/components/oneagent/core/AuxEngine.sys.mjs";
import { DecisionEngine } from "moz-src:///browser/components/oneagent/core/DecisionEngine.sys.mjs";
import { BrowserSandbox } from "moz-src:///browser/components/oneagent/runtime/BrowserSandbox.sys.mjs";
import { SystemSandbox } from "moz-src:///browser/components/oneagent/runtime/SystemSandbox.sys.mjs";

export class OneAgentOrchestrator {
  #window = null;
  #activeRun = null;
  #sessions = new Map();
  #listeners = new Set();
  #steeringQueue = [];
  #isPaused = false;
  #pauseResolve = null;

  constructor(window) {
    this.#window = window;
  }

  static forWindow(win) {
    if (!win._oneAgentOrchestrator) {
      win._oneAgentOrchestrator = new OneAgentOrchestrator(win);
    }
    return win._oneAgentOrchestrator;
  }

  addListener(fn) {
    this.#listeners.add(fn);
  }

  removeListener(fn) {
    this.#listeners.delete(fn);
  }

  emit(type, payload) {
    for (const listener of this.#listeners) {
      try {
        listener(type, payload);
      } catch (e) {
        console.error("OneAgent listener error:", e);
      }
    }
  }

  pushAuxSteering(text) {
    this.#steeringQueue.push(text);
    this.emit("trace", { type: "steering", text });
  }

  pause() {
    this.#isPaused = true;
    const tab = this.#window.gBrowser?.selectedTab;
    if (tab) {
      tab.setAttribute("oneagent-state", "paused");
    }
    this.emit("state", { state: "paused" });
  }

  resume() {
    this.#isPaused = false;
    const tab = this.#window.gBrowser?.selectedTab;
    if (tab) {
      tab.setAttribute("oneagent-state", "active");
    }
    if (this.#pauseResolve) {
      this.#pauseResolve();
      this.#pauseResolve = null;
    }
    this.emit("state", { state: "active" });
  }

  stop() {
    if (this.#activeRun) {
      this.#activeRun.abortController.abort();
      this.#activeRun = null;
    }
    this.resume();
    const tab = this.#window.gBrowser?.selectedTab;
    if (tab) {
      tab.removeAttribute("oneagent-state");
    }
    this.emit("state", { state: "idle" });
  }

  async runGoal(userPrompt, conversationId = "default") {
    this.stop();
    const abortController = new AbortController();
    this.#activeRun = { conversationId, abortController };
    this.#steeringQueue = [];
    this.emit("state", { state: "active" });

    let messages = this.#sessions.get(conversationId) || [];
    messages.push({ role: "user", content: userPrompt });
    this.emit("message", { role: "user", content: userPrompt });

    try {
      let turns = 0;
      while (turns < 15 && !abortController.signal.aborted) {
        turns++;
        const assistantMsg = await BrainEngine.runTurn({
          messages,
          signal: abortController.signal,
        });

        messages.push(assistantMsg);
        if (assistantMsg.content) {
          this.emit("message", { role: "assistant", content: assistantMsg.content });
        }

        if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
          break;
        }

        for (const toolCall of assistantMsg.tool_calls) {
          if (abortController.signal.aborted) {
            break;
          }
          const { name, arguments: argsStr } = toolCall.function;
          const args = JSON.parse(argsStr || "{}");
          this.emit("trace", { type: "tool_start", name, args });

          let result;
          if (name === "browser_exec") {
            result = await BrowserSandbox.execute(args.code, this.#window);
          } else if (name === "system_exec") {
            result = await SystemSandbox.execute(args.code);
          } else if (name === "ui_delegate") {
            result = await this.#executeUIDelegate(args, abortController.signal);
          } else {
            result = { error: `Unknown tool: ${name}` };
          }

          this.emit("trace", { type: "tool_end", name, result });
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result ?? null),
          });
        }
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        this.emit("error", { message: err.message });
      }
    } finally {
      this.stop();
      this.#sessions.set(conversationId, messages);
    }
  }

  async #executeUIDelegate(args, signal) {
    const { goal, checkpoints = [], maxSteps = 10 } = args;
    const tab = this.#window.gBrowser?.selectedTab;
    const browser = tab?.linkedBrowser;
    if (!browser) {
      return { error: "No active browser tab" };
    }

    tab.setAttribute("oneagent-state", "active");
    const actor = browser.browsingContext?.currentWindowGlobal?.getActor("OneAgentContent");
    if (!actor) {
      return { error: "OneAgentContent actor unavailable" };
    }

    let steps = 0;
    const history = [];

    while (steps < maxSteps && !signal.aborted) {
      steps++;
      if (this.#isPaused) {
        await new Promise(r => (this.#pauseResolve = r));
      }

      const observation = await actor.observePage({ viewportOnly: true });
      const userSteering = this.#steeringQueue.shift() || null;

      const hasInputs = observation.elements.some(e => e.tag === "input" || e.tag === "textarea");
      let candidates = [];
      if (hasInputs || userSteering) {
        candidates = await AuxEngine.proposeParameterizedCandidates({
          goal,
          domSnapshot: observation,
          userSteering,
        });
      }

      if (!candidates || candidates.length === 0) {
        candidates = observation.elements.slice(0, 8).map(el => ({
          id: el.ref,
          action: "click",
          ref: el.ref,
          label: `Click ${el.label || el.tag} (${el.ref})`,
        }));
      }

      const options = candidates.map(c => ({ id: c.id, label: c.label }));
      options.push({ id: "done", label: "Sub-goal achieved" });
      options.push({ id: "escalate", label: "Escalate back to Brain (blocked)" });

      const decisions = await DecisionEngine.evaluate({
        input: {
          goal,
          url: observation.url,
          last_actions: history.slice(-3),
          user_steering: userSteering,
          dom_snapshot: JSON.stringify(observation.elements.slice(0, 15)),
        },
        questions: [
          { id: "next_action", type: "choice", prompt: "Pick next action", options },
          { id: "is_done", type: "predicate", prompt: "Is checkpoint met?" },
        ],
      });

      const nextAction = decisions?.next_action?.selection;
      const confidence = decisions?.next_action?.confidence ?? 0.85;

      this.emit("trace", {
        type: "decision",
        action: nextAction,
        confidence,
        text: `Decision: ${nextAction} [${Math.round(confidence * 100)}% conf]`,
      });

      if (nextAction === "done" || decisions?.is_done?.value === true) {
        return { status: "completed", steps, lastUrl: observation.url };
      }
      if (nextAction === "escalate" || confidence < 0.65) {
        return { status: "escalated", reason: "Low confidence or blocked", steps };
      }

      const winningCandidate = candidates.find(c => c.id === nextAction);
      if (winningCandidate) {
        await actor.executeAction(winningCandidate);
        history.push(winningCandidate.label);
      }

      await new Promise(r => this.#window.setTimeout(r, 200));
    }

    return { status: "max_steps_reached", steps };
  }
}
