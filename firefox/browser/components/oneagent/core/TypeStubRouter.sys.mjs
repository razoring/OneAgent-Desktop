/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class TypeStubRouter {
  static getDeclarations(taskKeywords = []) {
    const base = `
declare const $stash: {
  get<T = any>(key: string): T | undefined;
  set(key: string, value: any): void;
  delete(key: string): boolean;
  keys(): string[];
};
`;

    const pageStub = `
declare namespace page {
  function observe(opts?: { viewportOnly?: boolean }): Promise<{ url: string; title: string; elements: any[]; textDigest: string }>;
  function click(refOrSelector: string): Promise<void>;
  function type(refOrSelector: string, text: string, opts?: { submit?: boolean; clear?: boolean }): Promise<void>;
  function sliderSet(refOrSelector: string, val: number): Promise<void>;
  function scroll(dir: "up" | "down"): Promise<void>;
  function evaluate<T>(fn: (...args: any[]) => T, ...args: any[]): Promise<T>;
  function extractMarkdown(): Promise<{ title: string; url: string; markdown: string }>;
}
`;

    const browserStub = `
declare namespace browser.tabs {
  function list(): Promise<Array<{ id: number; title: string; url: string; active: boolean }>>;
  function create(url: string, opts?: { active?: boolean }): Promise<{ id: number }>;
  function activate(tabId: number): Promise<void>;
  function close(tabId: number): Promise<void>;
}
declare namespace browser.prefs {
  function get(name: string): Promise<any>;
  function set(name: string, value: any): Promise<void>;
  function reset(name: string): Promise<void>;
  function search(kw: string): Promise<Array<{ name: string; value: any }>>;
}
declare namespace browser.devtools {
  function getConsoleLogs(): Promise<Array<{ level: string; text: string }>>;
  function getNetworkLog(opts?: { limit?: number }): Promise<Array<{ url: string; method: string; status: number }>>;
}
declare namespace browser.auth {
  function hasSavedLogin(): Promise<{ available: boolean; origin: string; count: number }>;
  function autofillCurrentTab(opts?: { submit?: boolean }): Promise<{ filled: boolean; submitted: boolean }>;
}
declare namespace browser.search {
  function query(q: string): Promise<{ digest: string; sources: Array<{ title: string; url: string }> }>;
}
`;

    const systemStub = `
declare namespace fs {
  function readText(path: string): Promise<string>;
  function writeText(path: string, content: string): Promise<void>;
  function list(dirPath: string): Promise<Array<{ name: string; path: string; isDir: boolean }>>;
}
declare namespace shell {
  function run(cmd: string, args?: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}
declare namespace mcp {
  function listTools(server?: string): Promise<Array<{ server: string; name: string }>>;
  function call(server: string, tool: string, args: Record<string, any>): Promise<any>;
}
declare namespace memory {
  function search(query: string): Promise<Array<{ id: string; fact: string }>>;
  function remember(fact: string): Promise<{ id: string }>;
}
declare namespace cron {
  function schedule(spec: { name: string; intervalMinutes?: number; conditionPrompt: string; actionPrompt: string }): Promise<{ id: string }>;
  function list(): Promise<Array<{ id: string; name: string; enabled: boolean }>>;
}
`;

    return `${base}\n${pageStub}\n${browserStub}\n${systemStub}`;
  }
}
