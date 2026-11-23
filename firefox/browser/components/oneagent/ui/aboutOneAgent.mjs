/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

export default class AboutOneAgent extends MozLitElement {
  static properties = {
    brainEndpoint: { state: true },
    brainModel: { state: true },
    auxEndpoint: { state: true },
    auxModel: { state: true },
    decisionMode: { state: true },
    searchProvider: { state: true },
    savedNotice: { state: true },
  };

  constructor() {
    super();
    this.brainEndpoint = Services.prefs.getStringPref("browser.oneagent.brain.endpoint", "");
    this.brainModel = Services.prefs.getStringPref("browser.oneagent.brain.model", "");
    this.auxEndpoint = Services.prefs.getStringPref("browser.oneagent.aux.endpoint", "");
    this.auxModel = Services.prefs.getStringPref("browser.oneagent.aux.model", "");
    this.decisionMode = Services.prefs.getStringPref("browser.oneagent.decision.mode", "local-adapter");
    this.searchProvider = Services.prefs.getStringPref("browser.oneagent.search.provider", "auto-background");
    this.savedNotice = false;
  }

  save() {
    Services.prefs.setStringPref("browser.oneagent.brain.endpoint", this.brainEndpoint);
    Services.prefs.setStringPref("browser.oneagent.brain.model", this.brainModel);
    Services.prefs.setStringPref("browser.oneagent.aux.endpoint", this.auxEndpoint);
    Services.prefs.setStringPref("browser.oneagent.aux.model", this.auxModel);
    Services.prefs.setStringPref("browser.oneagent.decision.mode", this.decisionMode);
    Services.prefs.setStringPref("browser.oneagent.search.provider", this.searchProvider);

    this.savedNotice = true;
    setTimeout(() => {
      this.savedNotice = false;
      this.requestUpdate();
    }, 2000);
    this.requestUpdate();
  }

  render() {
    return html`
      <link rel="stylesheet" href="chrome://browser/content/oneagent/aboutOneAgent.css" />

      <div class="settings-container">
        <h1>OneAgent Configuration</h1>
        <p class="subtitle">Unified System 2 Brain, System 1 Aux/Decision endpoints, and storage</p>

        ${this.savedNotice ? html`<div class="notice">Preferences saved successfully!</div>` : ""}

        <!-- System 2 Brain -->
        <fieldset class="section-box">
          <legend>System 2: Brain Model (OpenAI compatible)</legend>
          <label>Endpoint URL</label>
          <input
            type="text"
            .value=${this.brainEndpoint}
            @input=${e => (this.brainEndpoint = e.target.value)}
          />

          <label>Model ID</label>
          <input
            type="text"
            .value=${this.brainModel}
            @input=${e => (this.brainModel = e.target.value)}
          />
        </fieldset>

        <!-- System 1b Aux -->
        <fieldset class="section-box">
          <legend>System 1b: Auxiliary Model (Fast Local LLM)</legend>
          <label>Endpoint URL</label>
          <input
            type="text"
            .value=${this.auxEndpoint}
            @input=${e => (this.auxEndpoint = e.target.value)}
          />

          <label>Model ID</label>
          <input
            type="text"
            .value=${this.auxModel}
            @input=${e => (this.auxModel = e.target.value)}
          />
        </fieldset>

        <!-- System 1a Decision -->
        <fieldset class="section-box">
          <legend>System 1a: Decision Policy</legend>
          <label>Mode</label>
          <select
            .value=${this.decisionMode}
            @change=${e => (this.decisionMode = e.target.value)}
          >
            <option value="local-adapter">Local Adapter (uses Aux Model)</option>
            <option value="remote-decisions-api">Remote POST /v1/decisions API</option>
          </select>
        </fieldset>

        <!-- Search -->
        <fieldset class="section-box">
          <legend>Tabless Background Search</legend>
          <label>Search Provider</label>
          <select
            .value=${this.searchProvider}
            @change=${e => (this.searchProvider = e.target.value)}
          >
            <option value="auto-background">Auto Background (Fetch + Hidden Windowless Browser)</option>
            <option value="searxng">SearXNG Endpoint</option>
            <option value="tavily">Tavily Search API</option>
          </select>
        </fieldset>

        <div class="actions-bar">
          <button class="save-btn" @click=${() => this.save()}>Save Settings</button>
        </div>
      </div>
    `;
  }
}

customElements.define("about-oneagent", AboutOneAgent);
