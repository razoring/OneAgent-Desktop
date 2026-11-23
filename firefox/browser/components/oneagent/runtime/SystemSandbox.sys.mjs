/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { SharedStash } from "moz-src:///browser/components/oneagent/runtime/SharedStash.sys.mjs";
import { GuardrailPolicy } from "moz-src:///browser/components/oneagent/runtime/GuardrailPolicy.sys.mjs";
import { MCPClientManager } from "moz-src:///browser/components/oneagent/services/MCPClientManager.sys.mjs";
import { OneAgentMemory } from "moz-src:///browser/components/oneagent/services/OneAgentMemory.sys.mjs";
import { SkillManager } from "moz-src:///browser/components/oneagent/services/SkillManager.sys.mjs";
import { OneAgentCron } from "moz-src:///browser/components/oneagent/services/OneAgentCron.sys.mjs";

export class SystemSandbox {
  static async execute(code) {
    const fsFacade = {
      async readText(pathStr) {
        GuardrailPolicy.checkPathAccess(pathStr);
        return IOUtils.readUTF8(pathStr);
      },
      async writeText(pathStr, content) {
        GuardrailPolicy.checkPathAccess(pathStr);
        await IOUtils.writeUTF8(pathStr, content, { tmpPath: `${pathStr}.tmp` });
      },
      async list(dirPath) {
        GuardrailPolicy.checkPathAccess(dirPath);
        const children = await IOUtils.getChildren(dirPath);
        const results = [];
        for (const child of children) {
          const stat = await IOUtils.stat(child);
          results.push({
            path: child,
            name: PathUtils.filename(child),
            isDir: stat.type === "directory",
            size: stat.size,
          });
        }
        return results;
      },
    };

    const shellFacade = {
      async run(cmd, args = [], opts = {}) {
        const { Subprocess } = ChromeUtils.importESModule("resource://gre/modules/Subprocess.sys.mjs");
        const proc = await Subprocess.call({
          command: cmd,
          arguments: args,
          workdir: opts.cwd || PathUtils.profileDir,
        });
        const stdout = await proc.stdout.readString();
        const stderr = await proc.stderr.readString();
        const { exitCode } = await proc.wait();
        return { exitCode, stdout, stderr };
      },
    };

    const mcpFacade = {
      listTools: s => MCPClientManager.listTools(s),
      call: (s, t, a) => MCPClientManager.callTool(s, t, a),
    };

    const memoryFacade = {
      search: q => OneAgentMemory.search(q),
      remember: (f, t) => OneAgentMemory.remember(f, t),
    };

    const skillsFacade = {
      list: () => SkillManager.listSkills(),
      load: n => SkillManager.loadSkill(n),
    };

    const cronFacade = {
      schedule: spec => OneAgentCron.schedule(spec),
      list: () => OneAgentCron.listJobs(),
      remove: id => OneAgentCron.removeJob(id),
    };

    const sandbox = Cu.Sandbox(Services.scriptSecurityManager.createNullPrincipal({}), {
      wantComponents: false,
      wantGlobalProperties: ["URL", "URLSearchParams", "TextEncoder", "TextDecoder", "crypto", "structuredClone"],
    });

    sandbox.fs = Cu.cloneInto(fsFacade, sandbox, { cloneFunctions: true });
    sandbox.shell = Cu.cloneInto(shellFacade, sandbox, { cloneFunctions: true });
    sandbox.mcp = Cu.cloneInto(mcpFacade, sandbox, { cloneFunctions: true });
    sandbox.memory = Cu.cloneInto(memoryFacade, sandbox, { cloneFunctions: true });
    sandbox.skills = Cu.cloneInto(skillsFacade, sandbox, { cloneFunctions: true });
    sandbox.cron = Cu.cloneInto(cronFacade, sandbox, { cloneFunctions: true });
    sandbox.$stash = Cu.cloneInto(SharedStash, sandbox, { cloneFunctions: true });

    try {
      const wrappedScript = `(async () => { "use strict"; ${code} })()`;
      const result = await Cu.evalInSandbox(wrappedScript, sandbox);
      return result !== undefined ? structuredClone(result) : null;
    } catch (err) {
      return { error: err.message, stack: err.stack };
    } finally {
      Cu.nukeSandbox(sandbox);
    }
  }
}
