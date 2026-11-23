/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const gStashStore = new Map();

export const SharedStash = {
  get(key) {
    const val = gStashStore.get(key);
    return val !== undefined ? structuredClone(val) : undefined;
  },
  set(key, val) {
    gStashStore.set(key, structuredClone(val));
  },
  delete(key) {
    return gStashStore.delete(key);
  },
  keys() {
    return Array.from(gStashStore.keys());
  },
  clear() {
    gStashStore.clear();
  },
};
