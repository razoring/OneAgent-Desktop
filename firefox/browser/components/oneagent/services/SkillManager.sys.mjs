/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class SkillManager {
  static async listSkills() {
    const profilePath = PathUtils.profileDir;
    const skillsDir = PathUtils.join(profilePath, "oneagent", "skills");
    if (!(await IOUtils.exists(skillsDir))) {
      return [];
    }
    const entries = await IOUtils.getChildren(skillsDir);
    const skills = [];
    for (const entry of entries) {
      if (entry.endsWith(".md")) {
        const text = await IOUtils.readUTF8(entry);
        skills.push({
          name: PathUtils.filename(entry).replace(/\.md$/, ""),
          summary: text.slice(0, 200).trim(),
        });
      }
    }
    return skills;
  }

  static async loadSkill(name) {
    const profilePath = PathUtils.profileDir;
    const skillPath = PathUtils.join(profilePath, "oneagent", "skills", `${name}.md`);
    if (await IOUtils.exists(skillPath)) {
      return IOUtils.readUTF8(skillPath);
    }
    throw new Error(`Skill "${name}" not found at ${skillPath}`);
  }
}
