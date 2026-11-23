/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html, repeat } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

export default class OneAgentSidebar extends MozLitElement {
  static properties = {
    messages: { state: true },
    traces: { state: true },
    state: { state: true },
    inputText: { state: true },
  };

  constructor() {
    super();
    this.messages = [];
    this.traces = [];
    this.state = "idle";
    this.inputText = "";
  }

  get orchestrator() {
    return window.parent?.OneAgentOrchestrator?.forWindow(window.parent);
  }

  connectedCallback() {
    super.connectedCallback();
    this._onOrchestratorEvent = (type, payload) => {
      if (type === "state") {
        this.state = payload.state;
      } else if (type === "message") {
        this.messages = [...this.messages, payload];
      } else if (type === "trace") {
        this.traces = [...this.traces.slice(-8), payload];
      }
      this.requestUpdate();
    };
    this.orchestrator?.addListener(this._onOrchestratorEvent);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._onOrchestratorEvent) {
      this.orchestrator?.removeListener(this._onOrchestratorEvent);
    }
  }

  onSubmit() {
    const text = this.inputText.trim();
    if (!text || this.state === "active") {
      return;
    }
    this.inputText = "";
    this.orchestrator?.runGoal(text);
  }

  onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.onSubmit();
    }
  }

  openSettings() {
    window.parent?.gBrowser?.addTrustedTab("chrome://browser/content/oneagent/aboutOneAgent.html");
  }

  render() {
    return html`
      <link rel="stylesheet" href="chrome://browser/content/oneagent/sidebar.css" />

      <div class="sidebar-wrapper">
        <!-- Header -->
        <header class="sidebar-header">
          <div class="header-title">
            <span class="logo-sparkle">✦</span>
            <span class="app-name">OneAgent</span>
          </div>
          <div class="status-pill ${this.state}">
            ${this.state === "active" ? "Running" : this.state === "paused" ? "Paused" : "Idle"}
          </div>
          <button class="icon-btn settings-btn" title="Settings" @click=${() => this.openSettings()}>
            ⚙
          </button>
        </header>

        <!-- Traces & Decisions Stream -->
        ${this.traces.length > 0
          ? html`
              <section class="trace-section">
                <div class="section-title">MICRO-DECISIONS</div>
                <div class="trace-log">
                  ${repeat(
                    this.traces,
                    (t, idx) => idx,
                    t => html`<div class="trace-item">${t.text || JSON.stringify(t)}</div>`
                  )}
                </div>
              </section>
            `
          : ""}

        <!-- Chat Transcript -->
        <div class="chat-container">
          ${repeat(
            this.messages,
            (m, idx) => idx,
            m => html`
              <div class="chat-bubble ${m.role}">
                <div class="bubble-sender">${m.role === "user" ? "You" : "OneAgent"}</div>
                <div class="bubble-content">${m.content}</div>
              </div>
            `
          )}
        </div>

        <!-- Composer -->
        <footer class="composer-box">
          <textarea
            class="composer-input"
            rows="2"
            placeholder="Direct OneAgent (e.g., 'Book lowest flight JFK to LHR')..."
            .value=${this.inputText}
            @input=${e => (this.inputText = e.target.value)}
            @keydown=${e => this.onKeyDown(e)}
          ></textarea>
          <div class="composer-bar">
            <span class="model-hint">Brain: GLM-30B | Aux: Jev</span>
            <button
              class="send-btn"
              ?disabled=${this.state === "active" || !this.inputText.trim()}
              @click=${() => this.onSubmit()}
            >
              Send
            </button>
          </div>
        </footer>
      </div>
    `;
  }
}

customElements.define("oneagent-sidebar", OneAgentSidebar);
