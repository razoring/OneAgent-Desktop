/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * LightweightThemeChild forwards theme data to in-content pages.
 */
export class LightweightThemeChild extends JSWindowActorChild {
  constructor() {
    super();
    this._initted = false;
    Services.cpmm.sharedData.addEventListener("change", this);
  }

  didDestroy() {
    Services.cpmm.sharedData.removeEventListener("change", this);
  }

  _getChromeOuterWindowID() {
    try {
      // Getting the browserChild throws an exception when it is null.
      let browserChild = this.docShell.browserChild;
      if (browserChild) {
        return browserChild.chromeOuterWindowID;
      }
    } catch (ex) {}

    if (
      Services.appinfo.processType === Services.appinfo.PROCESS_TYPE_DEFAULT
    ) {
      return this.browsingContext.topChromeWindow.docShell.outerWindowID;
    }

    // Return a false-y outerWindowID if we can't manage to get a proper one.
    // Note that no outerWindowID will ever have this ID.
    return 0;
  }

  /**
   * Handles "change" events on the child sharedData map, and notifies
   * our content page if its theme data was among the changed keys.
   */
  handleEvent(event) {
    switch (event.type) {
      // Make sure to update the theme data on first page show.
      case "pageshow":
      case "DOMContentLoaded":
        if (this._getChromeOuterWindowID()) {
          this._initted = true;
          this.update();
        }
        break;

      case "change":
        if (
          event.changedKeys.includes(`theme/${this._getChromeOuterWindowID()}`)
        ) {
          this.update();
        }
        break;
    }
  }

  /**
   * Forward the theme data to the page.
   */
  update() {
    const themeData = Services.cpmm.sharedData.get(
      `theme/${this._getChromeOuterWindowID()}`
    );
    const root = this.contentWindow?.document?.documentElement;
    if (root) {
      const oa = themeData?._oaTheme;
      const vars = [
        ["--oa-theme-tint", oa?.tint],
        ["--oa-theme-accent", oa?.accent],
        ["--oa-theme-accent-hover", oa?.accentHover],
        ["--oa-theme-accent-active", oa?.accentActive],
        ["--oa-theme-accent-text", oa?.accentText],
      ];
      for (const [name, val] of vars) {
        if (val) {
          root.style.setProperty(name, val);
        } else {
          root.style.removeProperty(name);
        }
      }
    }
    const event = Cu.cloneInto(
      {
        detail: {
          data: themeData,
        },
      },
      this.contentWindow
    );
    this.contentWindow.dispatchEvent(
      new this.contentWindow.CustomEvent("LightweightTheme:Set", event)
    );
  }
}
