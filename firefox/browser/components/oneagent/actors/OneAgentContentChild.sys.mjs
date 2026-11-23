/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class OneAgentContentChild extends JSWindowActorChild {
  #refToElement = new Map();
  #activeSecrets = new Set();
  #refCounter = 0;

  receiveMessage(message) {
    switch (message.name) {
      case "ObservePage":
        return this.#observePage(message.data || {});
      case "ExecuteAction":
        return this.#executeAction(message.data || {});
      case "EvaluateScript":
        return this.#evaluateScript(message.data || {});
      case "BlindFill":
        return this.#blindFill(message.data || {});
      case "ExtractMarkdown":
        return this.#extractMarkdown();
      default:
        return Promise.reject(new Error(`Unknown OneAgentContent message: ${message.name}`));
    }
  }

  #observePage(options) {
    const doc = this.document;
    if (!doc) {
      return { url: "", title: "", elements: [], textDigest: "" };
    }

    this.#refToElement.clear();
    this.#refCounter = 0;

    const interactiveQuery =
      "a[href], button, input, select, textarea, [role='button'], [role='link'], [role='checkbox'], [role='tab'], [role='menuitem'], [contenteditable='true']";
    const rawElements = Array.from(doc.querySelectorAll(interactiveQuery));
    const win = this.contentWindow;
    const viewW = win.innerWidth;
    const viewH = win.innerHeight;

    const elements = [];
    for (const el of rawElements) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        continue;
      }
      const style = win.getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") {
        continue;
      }

      if (options.viewportOnly) {
        if (rect.bottom < 0 || rect.top > viewH || rect.right < 0 || rect.left > viewW) {
          continue;
        }
      }

      this.#refCounter++;
      const ref = `@e${this.#refCounter}`;
      this.#refToElement.set(ref, new WeakRef(el));

      const isPass =
        el.tagName === "INPUT" &&
        (el.type === "password" || el.autocomplete?.includes("password"));

      if (isPass && el.value) {
        this.#activeSecrets.add(el.value);
      }

      let label =
        el.getAttribute("aria-label") ||
        el.title ||
        el.placeholder ||
        el.innerText?.slice(0, 50)?.trim() ||
        el.getAttribute("alt") ||
        "";

      elements.push({
        ref,
        tag: el.tagName.toLowerCase(),
        type: el.type || null,
        role: el.getAttribute("role") || null,
        label: this.#redactString(label),
        value: isPass ? "[REDACTED_SECRET]" : this.#redactString(el.value || ""),
        isPassword: isPass,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        },
      });

      if (elements.length >= (options.maxElements || 80)) {
        break;
      }
    }

    let textDigest = doc.body?.innerText?.slice(0, 1500) || "";
    textDigest = this.#redactString(textDigest);

    return {
      url: doc.location?.href || "",
      title: doc.title || "",
      elements,
      textDigest,
    };
  }

  async #executeAction(data) {
    const { action, ref, selector, value, options } = data;
    let target = null;
    if (ref && this.#refToElement.has(ref)) {
      target = this.#refToElement.get(ref)?.deref();
    }
    if (!target && selector) {
      target = this.document.querySelector(selector);
    }
    if (!target) {
      throw new Error(`Target not found for action ${action} (ref: ${ref}, selector: ${selector})`);
    }

    target.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    const rect = target.getBoundingClientRect();
    this.sendAsyncMessage("OneAgent:HighlightTarget", {
      ref,
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      label: data.label || action,
    });

    const win = this.contentWindow;
    switch (action) {
      case "click": {
        target.focus();
        target.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, cancelable: true, view: win }));
        target.dispatchEvent(new win.MouseEvent("mouseup", { bubbles: true, cancelable: true, view: win }));
        target.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true, view: win }));
        return { success: true };
      }
      case "type": {
        target.focus();
        if (options?.clear !== false) {
          target.value = "";
        }
        target.value = value || "";
        target.dispatchEvent(new win.Event("input", { bubbles: true }));
        target.dispatchEvent(new win.Event("change", { bubbles: true }));
        if (options?.submit && target.form) {
          target.form.requestSubmit ? target.form.requestSubmit() : target.form.submit();
        }
        return { success: true };
      }
      case "sliderSet": {
        target.focus();
        target.value = value;
        target.dispatchEvent(new win.Event("input", { bubbles: true }));
        target.dispatchEvent(new win.Event("change", { bubbles: true }));
        return { success: true };
      }
      case "select": {
        target.focus();
        target.value = value;
        target.dispatchEvent(new win.Event("change", { bubbles: true }));
        return { success: true };
      }
      case "scroll": {
        const delta = value === "up" ? -400 : 400;
        win.scrollBy({ top: delta, behavior: "smooth" });
        return { success: true };
      }
      default:
        throw new Error(`Unsupported action type: ${action}`);
    }
  }

  async #evaluateScript({ script, args }) {
    const win = this.contentWindow;
    const fn = new win.Function("args", `"use strict"; return (${script})(...args);`);
    const rawResult = await fn.call(win, args || []);
    return this.#redactSecretsFromObject(rawResult);
  }

  async #blindFill({ username, password, submit }) {
    const doc = this.document;
    const passInput = doc.querySelector("input[type='password']");
    if (!passInput) {
      return { filled: false, submitted: false, reason: "No password field found" };
    }

    if (password) {
      this.#activeSecrets.add(password);
    }

    if (username) {
      const userInput =
        doc.querySelector("input[type='email'], input[type='text'][name*='user'], input[autocomplete='username']") ||
        passInput.form?.querySelector("input[type='text'], input[type='email']");
      if (userInput) {
        userInput.value = username;
        userInput.dispatchEvent(new this.contentWindow.Event("input", { bubbles: true }));
        userInput.dispatchEvent(new this.contentWindow.Event("change", { bubbles: true }));
      }
    }

    passInput.value = password;
    passInput.dispatchEvent(new this.contentWindow.Event("input", { bubbles: true }));
    passInput.dispatchEvent(new this.contentWindow.Event("change", { bubbles: true }));

    let didSubmit = false;
    if (submit && passInput.form) {
      didSubmit = true;
      passInput.form.requestSubmit ? passInput.form.requestSubmit() : passInput.form.submit();
    }

    return { filled: true, submitted: didSubmit };
  }

  #extractMarkdown() {
    const doc = this.document;
    const title = doc.title || "";
    const main = doc.querySelector("main, article, [role='main']") || doc.body;
    let markdown = main ? main.innerText || "" : "";
    markdown = this.#redactString(markdown);
    return {
      title,
      url: doc.location?.href || "",
      markdown: markdown.slice(0, 12000),
    };
  }

  #redactString(str) {
    if (typeof str !== "string" || !str) {
      return str;
    }
    let result = str;
    for (const secret of this.#activeSecrets) {
      if (secret && secret.length >= 3) {
        result = result.replaceAll(secret, "[REDACTED_SECRET]");
      }
    }
    return result;
  }

  #redactSecretsFromObject(val) {
    if (typeof val === "string") {
      return this.#redactString(val);
    }
    if (Array.isArray(val)) {
      return val.map(item => this.#redactSecretsFromObject(item));
    }
    if (val && typeof val === "object") {
      const scrubbed = {};
      for (const [k, v] of Object.entries(val)) {
        scrubbed[k] = this.#redactSecretsFromObject(v);
      }
      return scrubbed;
    }
    return val;
  }
}
