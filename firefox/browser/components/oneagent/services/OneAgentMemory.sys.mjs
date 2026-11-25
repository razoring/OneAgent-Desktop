/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class OneAgentMemory {
  static #memoryDir = null;

  static async #ensureDir() {
    if (!this.#memoryDir) {
      this.#memoryDir = PathUtils.join(PathUtils.profileDir, "oneagent");
      await IOUtils.makeDirectory(this.#memoryDir, { ignoreExisting: true });
    }
    return this.#memoryDir;
  }

  static async search(query) {
    const dir = await this.#ensureDir();
    const memFile = PathUtils.join(dir, "MEMORY.md");
    if (!(await IOUtils.exists(memFile))) {
      return [];
    }
    const text = await IOUtils.readUTF8(memFile);
    const lines = text.split("\n").filter(l => l.trim().startsWith("- "));
    const qLower = query.toLowerCase();

    return lines
      .filter(l => l.toLowerCase().includes(qLower))
      .map((l, idx) => ({ id: `mem_${idx}`, fact: l.replace(/^- /, "").trim() }));
  }

  static async remember(fact, tags = []) {
    const dir = await this.#ensureDir();
    const memFile = PathUtils.join(dir, "MEMORY.md");
    const tagStr = tags.length > 0 ? ` [${tags.join(", ")}]` : "";
    const entry = `- ${fact}${tagStr}\n`;
    await IOUtils.writeUTF8(memFile, entry, { mode: "append" });
    return { id: `mem_${Date.now()}` };
  }
}
