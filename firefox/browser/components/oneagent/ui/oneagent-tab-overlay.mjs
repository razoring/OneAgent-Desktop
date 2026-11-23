/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

export default class OneAgentTabOverlay extends MozLitElement {
  static properties = {
    state: { type: String, reflect: true },
    statusText: { type: String },
    targetRect: { type: Object },
    targetLabel: { type: String },
  };

  constructor() {
    super();
    this.state = "hidden";
    this.statusText = "Agent Operating...";
    this.targetRect = null;
    this.targetLabel = "";
  }

  get orchestrator() {
    return window.OneAgentOrchestrator?.forWindow(window);
  }

  showTarget(data) {
    this.targetRect = data.rect;
    this.targetLabel = data.label || data.ref;
    this.requestUpdate();
    window.setTimeout(() => {
      this.targetRect = null;
      this.requestUpdate();
    }, 700);
  }

  onPauseClick() {
    if (this.state === "paused") {
      this.orchestrator?.resume();
    } else {
      this.orchestrator?.pause();
    }
  }

  onStopClick() {
    this.orchestrator?.stop();
  }

  onSteerKeydown(e) {
    if (e.key === "Enter" && e.target.value.trim()) {
      this.orchestrator?.pushAuxSteering(e.target.value.trim());
      e.target.value = "";
    }
  }

  render() {
    if (this.state === "hidden") {
      return html`<style>:host { display: none !important; }</style>`;
    }

    const isPaused = this.state === "paused";

    return html`
      <link rel="stylesheet" href="chrome://browser/content/oneagent/oneagent-tab-overlay.css" />

      <!-- Input Lockout Shield -->
      <div
        class="interaction-shield"
        style="pointer-events: ${isPaused ? 'none' : 'all'};"
        @click=${e => e.stopPropagation()}
      ></div>

      <!-- Apple Intelligence Iridescent Perimeter Aura -->
      <div class="aura-perimeter"></div>

      <!-- Target Box Overlay -->
      ${this.targetRect
        ? html`
            <div
              class="target-box"
              style="
                left: ${this.targetRect.x}px;
                top: ${this.targetRect.y}px;
                width: ${this.targetRect.w}px;
                height: ${this.targetRect.h}px;
              "
            >
              <div class="target-tag">${this.targetLabel}</div>
            </div>
          `
        : ""}

      <!-- Frosted Glass Bottom HUD Pill -->
      <div class="hud-pill" @click=${e => e.stopPropagation()}>
        <div class="hud-status">
          <span class="status-dot ${isPaused ? 'paused' : 'active'}"></span>
          <span class="status-label">${isPaused ? "Paused" : this.statusText}</span>
        </div>

        <button class="hud-btn" @click=${() => this.onPauseClick()}>
          ${isPaused ? "▶ Resume" : "⏸ Pause"}
        </button>

        <button class="hud-btn stop" @click=${() => this.onStopClick()}>
          ⏹ Stop
        </button>

        <div class="hud-divider"></div>

        <input
          class="hud-steer-input"
          type="text"
          placeholder="Steer aux model..."
          @keydown=${e => this.onSteerKeydown(e)}
        />
      </div>
    `;
  }
}

customElements.define("oneagent-tab-overlay", OneAgentTabOverlay);
