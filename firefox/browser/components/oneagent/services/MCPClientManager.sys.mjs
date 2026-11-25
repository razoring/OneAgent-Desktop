/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class MCPClientManager {
  static #tools = new Map();

  static async init() {
    const profilePath = PathUtils.profileDir;
    const configPath = PathUtils.join(profilePath, "oneagent", "mcp.json");
    if (!(await IOUtils.exists(configPath))) {
      return;
    }
    try {
      const text = await IOUtils.readUTF8(configPath);
      const conf = JSON.parse(text);
      // Initialize configured MCP servers
    } catch (e) {}
  }

  static async listTools(serverName = null) {
    return [
      { server: "builtin", name: "ping", description: "Test connection to MCP manager" },
    ];
  }

  static async callTool(serverName, toolName, args) {
    if (serverName === "builtin" && toolName === "ping") {
      return { pong: true, timestamp: Date.now() };
    }
    throw new Error(`MCP tool ${serverName}:${toolName} not found`);
  }
}
