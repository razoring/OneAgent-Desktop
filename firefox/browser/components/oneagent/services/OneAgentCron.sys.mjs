/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class OneAgentCron {
  static #jobs = [];

  static async schedule(spec) {
    const job = {
      id: `cron_${Date.now()}`,
      name: spec.name,
      intervalMinutes: spec.intervalMinutes || 60,
      conditionPrompt: spec.conditionPrompt,
      actionPrompt: spec.actionPrompt,
      enabled: true,
      lastRun: 0,
    };
    this.#jobs.push(job);
    return { id: job.id };
  }

  static async listJobs() {
    return this.#jobs;
  }

  static async removeJob(id) {
    this.#jobs = this.#jobs.filter(j => j.id !== id);
  }
}
