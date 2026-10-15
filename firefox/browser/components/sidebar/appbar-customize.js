/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const ctl = () => window.browsingContext.topChromeWindow.AppbarController;
const list = document.getElementById("apps");

function render() {
  list.replaceChildren();
  for (const tab of ctl().tabManager.tabs) {
    const li = document.createElement("li");
    const img = document.createElement("img");
    img.src = tab.iconUrl;
    const label = document.createElement("span");
    label.textContent = tab.title || tab.url;
    const btn = document.createElement("button");
    btn.textContent = "Remove";
    btn.addEventListener("click", () => {
      ctl().tabManager.closeTab(tab.id);
      // closeTab may close the panel; reopen customize.
      ctl().showTool("viewCustomizeAppbar");
    });
    li.append(img, label, btn);
    list.append(li);
  }
}

document.getElementById("add-form").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("url");
  let url = input.value.trim();
  if (!url) {
    return;
  }
  if (!/^[a-z]+:/i.test(url)) {
    url = "https://" + url;
  }
  ctl().tabManager.createTab(url, { select: false });
  input.value = "";
  render();
});

render();
