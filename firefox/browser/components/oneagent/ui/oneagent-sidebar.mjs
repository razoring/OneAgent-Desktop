/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  classMap,
  html,
  nothing,
  repeat,
  styleMap,
} from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";
import "chrome://global/content/elements/moz-button.mjs";
import "chrome://global/content/elements/moz-message-bar.mjs";
import "chrome://global/content/elements/panel-list.mjs";

const { OneAgentOrchestrator } =
  typeof ChromeUtils !== "undefined"
    ? ChromeUtils.importESModule(
        "moz-src:///browser/components/oneagent/core/OneAgentOrchestrator.sys.mjs"
      )
    : {};

const ICON_URLS = {
  menu: "chrome://browser/skin/menu.svg",
  sparkle: "chrome://global/skin/icons/highlights.svg",
  newChat: "chrome://browser/content/aiwindow/assets/new-chat.svg",
  settings: "chrome://global/skin/icons/settings.svg",
  close: "chrome://global/skin/icons/close.svg",
  delete: "chrome://global/skin/icons/delete.svg",
  chat: "chrome://browser/content/firefoxview/view-chats.svg",
  plus: "chrome://global/skin/icons/plus.svg",
  tab: "chrome://browser/skin/tab.svg",
  screenshot: "chrome://browser/skin/screenshot.svg",
  tool: "chrome://global/skin/icons/developer.svg",
  loading: "chrome://global/skin/icons/loading.svg",
  done: "chrome://global/skin/icons/check-filled.svg",
  user: "chrome://global/skin/icons/users.svg",
  send: "chrome://global/skin/icons/shaft-arrow-up.svg",
  stop: "chrome://browser/content/aiwindow/assets/stop-generation.svg",
  chevron: "chrome://global/skin/icons/arrow-down-12.svg",
};

const STARTER_PROMPTS = [
  {
    label: "Summarize active tab",
    prompt: "Summarize the active tab and extract key takeaways",
  },
  {
    label: "Compare open tabs",
    prompt: "Inspect my open tabs and compare their main points",
  },
  {
    label: "Inspect & fill form",
    prompt: "Inspect the DOM of the active tab and help fill out visible form fields",
  },
];

export default class OneAgentSidebar extends MozLitElement {
  static properties = {
    sessions: { state: true },
    currentSessionId: { state: true },
    messages: { state: true },
    streamingMessage: { state: true },
    state: { state: true },
    inputText: { state: true },
    errorMessage: { state: true },
    historyDrawerOpen: { state: true },
    attachments: { state: true },
    enabledTools: { state: true },
  };

  static queries = {
    plusMenu: "#oneagent-tools-menu",
    chatScrollArea: ".chat-scroll-area",
    composerInput: ".composer-textarea",
  };

  constructor() {
    super();
    this.currentSessionId = "session_" + Date.now();
    this.sessions = [];
    this.messages = [];
    this.streamingMessage = null;
    this.state = "idle";
    this.inputText = "";
    this.errorMessage = "";
    this.historyDrawerOpen = false;
    this.attachments = [];
    this.enabledTools = {
      browser_exec: true,
      system_exec: true,
      ui_delegate: true,
    };
  }

  get topWindow() {
    return (
      window.browsingContext?.topChromeWindow ||
      window.browsingContext?.embedderWindowGlobal?.browsingContext?.window ||
      (window.parent !== window ? window.parent : null)
    );
  }

  get orchestrator() {
    const win = this.topWindow;
    if (!win) {
      return null;
    }
    return (win.OneAgentOrchestrator || OneAgentOrchestrator)?.forWindow(win) || null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._loadInitialData();

    this._onOrchestratorEvent = (type, payload) => {
      if (type === "state") {
        this.state = payload.state;
        if (payload.state === "idle") {
          this.streamingMessage = null;
        }
      } else if (type === "message_stream") {
        if (payload.conversationId === this.currentSessionId) {
          this.streamingMessage = payload.content;
          this._scrollToBottom();
        }
      } else if (type === "message") {
        if (payload.conversationId === this.currentSessionId) {
          this.streamingMessage = null;
          const normalized = this.#normalizeIncomingMessage(payload);
          this.messages = [...this.messages, normalized];
          this._scrollToBottom();
        }
      } else if (type === "tool_call") {
        this.#applyToolCallUpdate(payload);
        this._scrollToBottom();
      } else if (type === "error") {
        this.streamingMessage = null;
        this.errorMessage = payload?.message || "Agent execution error.";
      } else if (type === "sessions_changed") {
        this.sessions = payload || [];
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

  #safeJson(raw) {
    if (!raw || typeof raw !== "string") {
      return raw ?? null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  }

  #normalizeIncomingMessage(payload) {
    const toolCalls = Array.isArray(payload.tool_calls)
      ? payload.tool_calls.map(tc => ({
          tool_call_id: tc.id,
          name: tc.function?.name || tc.name || "tool",
          args: this.#safeJson(tc.function?.arguments),
          status: "pending",
          result: null,
        }))
      : [];
    return {
      role: payload.role,
      content: payload.content || "",
      liveToolCalls: toolCalls,
    };
  }

  #formatSessionMessages(rawMessages) {
    const display = [];
    const byToolId = new Map();

    for (const msg of rawMessages || []) {
      if (msg.role === "user") {
        display.push({ role: "user", content: msg.content || "", liveToolCalls: [] });
      } else if (msg.role === "assistant") {
        const entry = this.#normalizeIncomingMessage(msg);
        for (const tc of entry.liveToolCalls) {
          tc.status = "finished";
          byToolId.set(tc.tool_call_id, tc);
        }
        display.push(entry);
      } else if (msg.role === "tool" && msg.tool_call_id) {
        const target = byToolId.get(msg.tool_call_id);
        if (target) {
          target.status = "finished";
          target.result = this.#safeJson(msg.content);
        }
      }
    }
    return display;
  }

  #applyToolCallUpdate(payload) {
    const idx = this.messages.findLastIndex(m => m.role === "assistant");
    if (idx < 0) {
      return;
    }
    const targetMsg = this.messages[idx];
    const currentTools = [...(targetMsg.liveToolCalls || [])];
    const existingIdx = currentTools.findIndex(
      t => t.tool_call_id === payload.tool_call_id
    );
    if (existingIdx >= 0) {
      currentTools[existingIdx] = {
        ...currentTools[existingIdx],
        ...payload,
      };
    } else {
      currentTools.push(payload);
    }
    const updated = [...this.messages];
    updated[idx] = { ...targetMsg, liveToolCalls: currentTools };
    this.messages = updated;
  }

  _loadInitialData() {
    if (!this.orchestrator) {
      return;
    }
    this.sessions = this.orchestrator.getSessions() || [];
    if (
      this.sessions.length > 0 &&
      !this.sessions.find(s => s.id === this.currentSessionId)
    ) {
      this.currentSessionId = this.sessions[0].id;
      this.messages = this.#formatSessionMessages(
        this.orchestrator.getSessionMessages(this.currentSessionId)
      );
    }
  }

  _scrollToBottom() {
    requestAnimationFrame(() => {
      const container = this.chatScrollArea;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }

  switchSession(id) {
    this.currentSessionId = id;
    this.streamingMessage = null;
    this.errorMessage = "";
    this.messages = this.#formatSessionMessages(
      this.orchestrator?.getSessionMessages(id) || []
    );
    this.historyDrawerOpen = false;
    this._scrollToBottom();
  }

  startNewChat() {
    this.currentSessionId = "session_" + Date.now();
    this.streamingMessage = null;
    this.errorMessage = "";
    this.messages = [];
    this.attachments = [];
    this.historyDrawerOpen = false;
  }

  deleteSession(e, id) {
    e.stopPropagation();
    this.orchestrator?.clearSession(id);
    this.sessions = this.orchestrator?.getSessions() || [];
    if (this.currentSessionId === id) {
      this.startNewChat();
    }
  }

  toggleHistoryDrawer() {
    this.historyDrawerOpen = !this.historyDrawerOpen;
  }

  #onPlusButtonClick(e) {
    e.stopPropagation();
    this.plusMenu?.toggle(e, e.currentTarget);
  }

  addTabContext() {
    const tab = this.topWindow?.gBrowser?.selectedTab;
    const url = tab?.linkedBrowser?.currentURI?.spec || "";
    const title = tab?.label || "Current tab";
    if (url) {
      this.attachments = [
        ...this.attachments.filter(a => a.type !== "tab"),
        { type: "tab", title, url },
      ];
    }
  }

  addScreenshot() {
    this.attachments = [
      ...this.attachments.filter(a => a.type !== "screenshot"),
      { type: "screenshot", title: "Viewport screenshot" },
    ];
  }

  toggleTool(toolName) {
    this.enabledTools = {
      ...this.enabledTools,
      [toolName]: !this.enabledTools[toolName],
    };
  }

  removeAttachment(idx) {
    this.attachments = this.attachments.filter((_, i) => i !== idx);
  }

  onSubmit(overridePrompt = null) {
    const text = (overridePrompt ?? this.inputText).trim();
    if ((!text && this.attachments.length === 0) || this.state === "active") {
      return;
    }

    if (!this.orchestrator) {
      this.errorMessage = "OneAgent orchestrator is unavailable in this window.";
      return;
    }

    const activeToolList = Object.entries(this.enabledTools)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name);

    const contextParts = this.attachments.map(a =>
      a.url ? `[Attached ${a.title}: ${a.url}]` : `[Attached ${a.title}]`
    );
    if (activeToolList.length < 3) {
      contextParts.push(`[Preferred tools: ${activeToolList.join(", ") || "none"}]`);
    }

    const fullPrompt = contextParts.length
      ? `${contextParts.join("\n")}\n\n${text || "Analyze attached context."}`
      : text;

    this.errorMessage = "";
    this.inputText = "";
    this.attachments = [];
    this.orchestrator.runGoal(fullPrompt, this.currentSessionId);
  }

  onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.onSubmit();
    }
  }

  openSettings() {
    const gBrowser = this.topWindow?.gBrowser;
    if (gBrowser) {
      gBrowser.selectedTab = gBrowser.addTrustedTab(
        "chrome://browser/content/oneagent/aboutOneAgent.html"
      );
    }
  }

  closeSidebar() {
    this.topWindow?.OneAgentUI?.toggleSidebar(this.topWindow, false);
  }

  #renderHistoryDrawer() {
    return html`
      ${this.historyDrawerOpen
        ? html`<div
            class="drawer-backdrop"
            @click=${() => (this.historyDrawerOpen = false)}
          ></div>`
        : nothing}

      <aside
        class=${classMap({
          "history-drawer": true,
          open: this.historyDrawerOpen,
        })}
        aria-label="Chat history"
      >
        <div class="history-header">
          <span class="drawer-title">Recent chats</span>
          <moz-button
            type="icon ghost"
            size="small"
            iconSrc=${ICON_URLS.close}
            title="Close history"
            aria-label="Close history"
            @click=${() => (this.historyDrawerOpen = false)}
          ></moz-button>
        </div>

        <div class="drawer-actions">
          <moz-button
            class="new-chat-drawer-btn"
            iconSrc=${ICON_URLS.newChat}
            label="New chat"
            @click=${() => this.startNewChat()}
          ></moz-button>
        </div>

        <div class="history-list" role="list">
          ${this.sessions.length === 0
            ? html`<div class="empty-history">No previous chats yet</div>`
            : repeat(
                this.sessions,
                s => s.id,
                s => html`
                  <div
                    role="listitem"
                    class=${classMap({
                      "history-item": true,
                      selected: s.id === this.currentSessionId,
                    })}
                    @click=${() => this.switchSession(s.id)}
                  >
                    <img
                      class="history-item-icon"
                      src=${ICON_URLS.chat}
                      alt=""
                    />
                    <span class="history-item-label">${s.title}</span>
                    <moz-button
                      class="delete-session-btn"
                      type="icon ghost"
                      size="small"
                      iconSrc=${ICON_URLS.delete}
                      title="Delete chat"
                      aria-label="Delete chat"
                      @click=${e => this.deleteSession(e, s.id)}
                    ></moz-button>
                  </div>
                `
              )}
        </div>
      </aside>
    `;
  }

  #renderToolCallCard(tc) {
    const isRunning = tc.status === "running" || tc.status === "pending";
    const statusIcon = isRunning ? ICON_URLS.loading : ICON_URLS.done;

    return html`
      <details class=${classMap({ "tool-call-card": true, [tc.status]: true })}>
        <summary class="tool-card-summary">
          <img
            class=${classMap({
              "tool-status-icon": true,
              spinning: isRunning,
            })}
            src=${statusIcon}
            alt=""
          />
          <img class="tool-type-icon" src=${ICON_URLS.tool} alt="" />
          <span class="tool-name">${tc.name}</span>
          <span class="tool-badge">${tc.status}</span>
          <img class="tool-chevron" src=${ICON_URLS.chevron} alt="" />
        </summary>
        <div class="tool-details">
          ${tc.args
            ? html`<div class="tool-section-label">Input</div>
                <pre class="code-preview">${JSON.stringify(tc.args, null, 2)}</pre>`
            : nothing}
          ${tc.result !== null && tc.result !== undefined
            ? html`<div class="tool-section-label">Output</div>
                <pre class="code-preview">${JSON.stringify(tc.result, null, 2)}</pre>`
            : nothing}
        </div>
      </details>
    `;
  }

  #renderMessage(m) {
    const isAssistant = m.role === "assistant";
    return html`
      <div class=${classMap({ "message-row": true, [m.role]: true })}>
        <div class="avatar-cell">
          <img
            class="avatar-icon"
            src=${isAssistant ? ICON_URLS.sparkle : ICON_URLS.user}
            alt=""
          />
        </div>
        <div class="bubble-cell">
          <div class="message-meta">${isAssistant ? "OneAgent" : "You"}</div>
          ${m.content
            ? html`<div class="message-content">${m.content}</div>`
            : nothing}
          ${m.liveToolCalls?.length
            ? html`
                <div class="tool-calls-container">
                  ${repeat(
                    m.liveToolCalls,
                    tc => tc.tool_call_id || tc.name,
                    tc => this.#renderToolCallCard(tc)
                  )}
                </div>
              `
            : nothing}
        </div>
      </div>
    `;
  }

  #renderEmptyState() {
    return html`
      <div class="empty-state">
        <div class="greeting-badge">
          <img class="greeting-icon" src=${ICON_URLS.sparkle} alt="" />
        </div>
        <h2 class="greeting-headline">How can OneAgent help?</h2>
        <p class="greeting-subtitle">
          Automate tabs, inspect pages, and run sandboxed tools in your browser.
        </p>
        <div class="suggestion-chips">
          ${STARTER_PROMPTS.map(
            item => html`
              <button
                type="button"
                class="suggestion-chip"
                @click=${() => this.onSubmit(item.prompt)}
              >
                <img class="chip-leading-icon" src=${ICON_URLS.sparkle} alt="" />
                <span>${item.label}</span>
              </button>
            `
          )}
        </div>
      </div>
    `;
  }

  render() {
    const canSend = Boolean(this.inputText.trim() || this.attachments.length);

    return html`
      <link rel="stylesheet" href="chrome://browser/content/oneagent/sidebar.css" />

      <div class="sidebar-layout">
        <header class="app-header">
          <div class="header-start">
            <moz-button
              type="icon ghost"
              size="small"
              iconSrc=${ICON_URLS.menu}
              title="Chat history"
              aria-label="Chat history"
              aria-expanded=${this.historyDrawerOpen ? "true" : "false"}
              @click=${() => this.toggleHistoryDrawer()}
            ></moz-button>
            <div class="brand-title">
              <img class="brand-icon" src=${ICON_URLS.sparkle} alt="" />
              <span class="brand-text">OneAgent</span>
            </div>
          </div>

          <div class="header-actions">
            <moz-button
              type="icon ghost"
              size="small"
              iconSrc=${ICON_URLS.newChat}
              title="New chat"
              aria-label="New chat"
              @click=${() => this.startNewChat()}
            ></moz-button>
            <moz-button
              type="icon ghost"
              size="small"
              iconSrc=${ICON_URLS.settings}
              title="Settings"
              aria-label="Settings"
              @click=${() => this.openSettings()}
            ></moz-button>
            <moz-button
              type="icon ghost"
              size="small"
              iconSrc=${ICON_URLS.close}
              title="Close sidebar"
              aria-label="Close sidebar"
              @click=${() => this.closeSidebar()}
            ></moz-button>
          </div>
        </header>

        <div class="main-body">
          ${this.#renderHistoryDrawer()}

          <main class="chat-viewport">
            ${this.errorMessage
              ? html`
                  <div class="error-banner">
                    <moz-message-bar
                      type="error"
                      .message=${this.errorMessage}
                      dismissable
                      @message-bar:user-dismissed=${() => (this.errorMessage = "")}
                    ></moz-message-bar>
                  </div>
                `
              : nothing}

            <div class="chat-scroll-area">
              ${this.messages.length === 0 && !this.streamingMessage
                ? this.#renderEmptyState()
                : nothing}

              ${repeat(
                this.messages,
                (_m, idx) => `${this.currentSessionId}_${idx}`,
                m => this.#renderMessage(m)
              )}

              ${this.streamingMessage
                ? html`
                    <div class="message-row assistant streaming">
                      <div class="avatar-cell">
                        <img
                          class="avatar-icon pulse"
                          src=${ICON_URLS.sparkle}
                          alt=""
                        />
                      </div>
                      <div class="bubble-cell">
                        <div class="message-meta">OneAgent</div>
                        <div class="message-content">${this.streamingMessage}</div>
                      </div>
                    </div>
                  `
                : nothing}
            </div>

            <footer class="composer-container">
              ${this.attachments.length > 0
                ? html`
                    <div class="attachment-bar">
                      ${this.attachments.map(
                        (a, i) => html`
                          <div class="attachment-chip">
                            <img
                              class="attachment-icon"
                              src=${a.type === "tab"
                                ? ICON_URLS.tab
                                : ICON_URLS.screenshot}
                              alt=""
                            />
                            <span class="chip-text">${a.title}</span>
                            <moz-button
                              type="icon ghost"
                              size="small"
                              iconSrc=${ICON_URLS.close}
                              title="Remove attachment"
                              aria-label="Remove attachment"
                              @click=${() => this.removeAttachment(i)}
                            ></moz-button>
                          </div>
                        `
                      )}
                    </div>
                  `
                : nothing}

              <div class="composer-box">
                <moz-button
                  class="plus-btn"
                  type="icon ghost"
                  iconSrc=${ICON_URLS.plus}
                  title="Add attachments and tools"
                  aria-label="Add attachments and tools"
                  aria-haspopup="menu"
                  @click=${e => this.#onPlusButtonClick(e)}
                ></moz-button>

                <panel-list id="oneagent-tools-menu">
                  <panel-item
                    icon
                    style=${styleMap({
                      "--panel-item-icon-url": `url("${ICON_URLS.tab}")`,
                    })}
                    @click=${() => this.addTabContext()}
                  >
                    Attach current tab
                  </panel-item>
                  <panel-item
                    icon
                    style=${styleMap({
                      "--panel-item-icon-url": `url("${ICON_URLS.screenshot}")`,
                    })}
                    @click=${() => this.addScreenshot()}
                  >
                    Attach viewport screenshot
                  </panel-item>
                  <hr />
                  <panel-item
                    type="checkbox"
                    ?checked=${this.enabledTools.browser_exec}
                    @click=${() => this.toggleTool("browser_exec")}
                  >
                    Browser sandbox (DOM &amp; tabs)
                  </panel-item>
                  <panel-item
                    type="checkbox"
                    ?checked=${this.enabledTools.system_exec}
                    @click=${() => this.toggleTool("system_exec")}
                  >
                    System sandbox (Files &amp; MCP)
                  </panel-item>
                  <panel-item
                    type="checkbox"
                    ?checked=${this.enabledTools.ui_delegate}
                    @click=${() => this.toggleTool("ui_delegate")}
                  >
                    Fast UI decision loop
                  </panel-item>
                </panel-list>

                <div class="textarea-grow-wrap" data-value=${this.inputText}>
                  <textarea
                    class="composer-textarea"
                    rows="1"
                    placeholder="Ask OneAgent..."
                    .value=${this.inputText}
                    @input=${e => (this.inputText = e.target.value)}
                    @keydown=${e => this.onKeyDown(e)}
                  ></textarea>
                </div>

                ${this.state === "active"
                  ? html`
                      <moz-button
                        class="composer-action-btn"
                        type="destructive"
                        iconSrc=${ICON_URLS.stop}
                        title="Stop generation"
                        aria-label="Stop generation"
                        @click=${() => this.orchestrator?.stop()}
                      ></moz-button>
                    `
                  : html`
                      <moz-button
                        class="composer-action-btn"
                        type="primary"
                        iconSrc=${ICON_URLS.send}
                        title="Send prompt"
                        aria-label="Send prompt"
                        ?disabled=${!canSend}
                        @click=${() => this.onSubmit()}
                      ></moz-button>
                    `}
              </div>
            </footer>
          </main>
        </div>
      </div>
    `;
  }
}

customElements.define("oneagent-sidebar", OneAgentSidebar);
