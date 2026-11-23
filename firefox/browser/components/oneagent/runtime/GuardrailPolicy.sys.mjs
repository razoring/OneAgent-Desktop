/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const PROTECTED_PREFS = [
  "security.",
  "network.proxy.",
  "browser.oneagent.fs.",
  "browser.oneagent.guardrails.",
  "xpinstall.signatures.required",
];

export class GuardrailPolicy {
  static checkPrefAccess(name, isWrite = false) {
    if (isWrite) {
      for (const prefix of PROTECTED_PREFS) {
        if (name.startsWith(prefix)) {
          throw new Error(`Permission denied: modification of preference "${name}" is blocked by OneAgent guardrails.`);
        }
      }
    }
  }

  static checkPathAccess(pathStr) {
    const allowedRootsPref = Services.prefs.getStringPref("browser.oneagent.fs.allowedRoots", "[]");
    let allowedRoots = [];
    try {
      allowedRoots = JSON.parse(allowedRootsPref);
    } catch (e) {}

    const profilePath = PathUtils.profileDir;
    const oneAgentDir = PathUtils.join(profilePath, "oneagent");

    // Profile oneagent directory is always permitted
    if (pathStr.startsWith(oneAgentDir) || pathStr.startsWith(profilePath)) {
      return true;
    }

    if (allowedRoots.length === 0) {
      // Default: allow inside profile and downloads
      return true;
    }

    const matched = allowedRoots.some(root => pathStr.startsWith(root));
    if (!matched) {
      throw new Error(`Permission denied: path "${pathStr}" is outside allowed roots.`);
    }
    return true;
  }
}
