import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// A deliberately small DOM shim keeps this regression suite dependency-free while
// still exercising ui.js's real delegated listeners and render output.
class FakeNode {
  constructor(tagName = "") {
    this.tagName = tagName.toUpperCase();
    this.parentNode = null;
    this.children = [];
    this.attributes = new Map();
    this._text = "";
    this.disabled = false;
    this.ownerDocument = null;
    this._scrollIntoViewCalls = [];
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    event.target ??= this;
    event.defaultPrevented ??= false;
    event.preventDefault ??= () => {
      event.defaultPrevented = true;
    };
    for (const listener of this.listeners.get(event.type) ?? []) listener(event);
    return !event.defaultPrevented;
  }

  appendChild(child) {
    child.parentNode = this;
    child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    return child;
  }

  setAttribute(name, value = "") {
    this.attributes.set(name, String(value));
    if (name === "disabled") this.disabled = true;
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  get id() {
    return this.getAttribute("id") ?? "";
  }

  get className() {
    return this.getAttribute("class") ?? "";
  }

  get dataset() {
    const data = {};
    for (const [name, value] of this.attributes) {
      if (name.startsWith("data-")) {
        const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        data[key] = value;
      }
    }
    return data;
  }

  get textContent() {
    return this._text + this.children.map((child) => child.textContent).join("");
  }

  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }

  set innerHTML(html) {
    this._text = "";
    this.children = parseMarkup(String(html), this);
  }

  matches(selector) {
    return selector
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .some((part) => matchesSimple(this, part));
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches?.(selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const found = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (child.matches(selector)) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }

  focus(options) {
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
  }

  scrollIntoView(options) {
    this._scrollIntoViewCalls.push(options);
  }
}

class FakeDocument extends FakeNode {
  constructor() {
    super("document");
    this.ownerDocument = this;
    this.activeElement = null;
    this.body = this.appendChild(new FakeNode("body"));
  }
}

function matchesSimple(node, selector) {
  if (!node.tagName || selector.includes(" ")) return false;
  const attributeParts = [...selector.matchAll(/\[([^\]=]+)(?:=['"]?([^\]'"]+)['"]?)?\]/g)];
  for (const [, name, expected] of attributeParts) {
    const actual = node.getAttribute(name);
    if (actual === null || (expected !== undefined && actual !== expected)) return false;
  }
  const withoutAttributes = selector.replace(/\[[^\]]+\]/g, "");
  const tag = withoutAttributes.match(/^[a-z*][a-z0-9-]*/i)?.[0];
  if (tag && tag !== "*" && node.tagName.toLowerCase() !== tag.toLowerCase()) return false;
  const id = withoutAttributes.match(/#([\w-]+)/)?.[1];
  if (id && node.id !== id) return false;
  const classes = [...withoutAttributes.matchAll(/\.([\w-]+)/g)].map((match) => match[1]);
  return classes.every((name) => node.className.split(/\s+/).includes(name));
}

function parseMarkup(html, parent) {
  parent.children = [];
  const stack = [parent];
  const tokens = html.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) ?? [];
  for (const token of tokens) {
    if (token.startsWith("<!--")) continue;
    if (token.startsWith("</")) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (!token.startsWith("<")) {
      stack.at(-1)._text += token;
      continue;
    }
    const opening = token.match(/^<\s*([a-z0-9-]+)([\s\S]*?)\/?\s*>$/i);
    if (!opening) continue;
    const [, tagName, rawAttributes] = opening;
    const node = new FakeNode(tagName);
    node.ownerDocument = parent.ownerDocument;
    for (const match of rawAttributes.matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g)) {
      const [, name, doubleQuoted, singleQuoted, bare] = match;
      node.setAttribute(name, doubleQuoted ?? singleQuoted ?? bare ?? "");
    }
    stack.at(-1).appendChild(node);
    if (!/\/\s*>$/.test(token) && !["meta", "link", "input", "img", "br", "hr"].includes(tagName)) {
      stack.push(node);
    }
  }
  return parent.children;
}

const testFile = fileURLToPath(import.meta.url);
const root = dirname(dirname(testFile));
const styles = readFileSync(join(root, "src", "styles.css"), "utf8");
const desktopGauntletRule = styles.match(/\.gauntlet\s*\{[^}]*\}/)?.[0] ?? "";
assert.match(
  desktopGauntletRule,
  /grid-template-areas:\s*"rail\s+stage"/,
  "desktop gauntlet must map the narrow first column to the rail and the flexible second column to the stage"
);
assert.match(styles, /\.rail\s*\{[^}]*grid-area:\s*rail/s);
assert.match(styles, /\.stage\s*\{[^}]*grid-area:\s*stage/s);
const mobileGauntletRule = styles.match(/@media\s*\(max-width:\s*1000px\)[\s\S]*?\.gauntlet\s*\{[^}]*\}/)?.[0] ?? "";
assert.match(
  mobileGauntletRule,
  /grid-template-areas:\s*"stage"\s*"rail"/,
  "mobile gauntlet must restore the stage-then-rail single-column order"
);
const document = new FakeDocument();
const app = document.body.appendChild(new FakeNode("div"));
app.setAttribute("id", "app");
const announcer = document.body.appendChild(new FakeNode("div"));
announcer.setAttribute("id", "announcer");
announcer.setAttribute("aria-live", "polite");
const window = new FakeNode("window");
window.scrollY = 0;
window.scrollCalls = [];
window.scrollTo = (options) => {
  window.scrollCalls.push(options);
  window.scrollY = options?.top ?? 0;
};

const storageValues = new Map();
globalThis.document = document;
globalThis.window = window;
globalThis.localStorage = {
  getItem: (key) => storageValues.get(key) ?? null,
  setItem: (key, value) => storageValues.set(key, String(value)),
  removeItem: (key) => storageValues.delete(key),
};
globalThis.confirm = () => true;

const G = await import(pathToFileURL(join(root, "src", "game.js")).href);
G.resetLineage();
await import(`${pathToFileURL(join(root, "src", "ui.js")).href}?ui-behavior=${Date.now()}`);

function click(target) {
  assert.ok(target, "expected a rendered target");
  app.dispatchEvent({ type: "click", target });
}

function keydown(key, target, options = {}) {
  const event = {
    type: "keydown",
    key,
    target,
    repeat: Boolean(options.repeat),
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
  window.dispatchEvent(event);
  return event;
}

function enabledChoice() {
  return app.querySelectorAll("[data-choice]").find((choice) => !choice.disabled);
}

function finishRun() {
  let guard = 0;
  while (G.getState().current && guard < 20) {
    click(enabledChoice());
    guard += 1;
  }
  assert.equal(G.getState().current, null, "run should reach the verdict screen");
}

assert.equal(app.getAttribute("aria-live"), null, "the app root must not be a live region");
assert.equal(announcer.getAttribute("aria-live"), "polite");
assert.match(announcer.textContent, /Checkpoint registry/);

click(app.querySelectorAll("button").find((button) => button.dataset.action === "start"));
assert.ok(G.getState().current, "start action should render a run");
const gauntlet = app.querySelector(".gauntlet");
assert.equal(gauntlet.children[0]?.className, "stage", "stage remains first in DOM/mobile order");
assert.equal(gauntlet.children[1]?.className, "rail", "rail remains second in DOM/mobile order");
window.scrollY = 420;
const scrollCallsBeforeChoice = window.scrollCalls.length;
click(enabledChoice());
assert.equal(G.getState().current.episodeIndex, 1, "a choice should advance to the next episode");
const nextHeading = app.querySelector(".episode__title");
assert.equal(document.activeElement, nextHeading, "the next episode heading should receive focus");
assert.ok(nextHeading._scrollIntoViewCalls.length, "the next episode should be scrolled into view");
assert.equal(window.scrollY, 420, "episode changes must not scroll the window to the top");
assert.equal(window.scrollCalls.length, scrollCallsBeforeChoice);
assert.match(announcer.textContent, /^Episode \d+ of \d+:/);

const repeatEvent = keydown("a", document.body, { repeat: true });
assert.equal(repeatEvent.defaultPrevented, false, "held shortcut repeats must be ignored");
assert.equal(G.getState().current.episodeIndex, 1);
const interactiveTarget = enabledChoice();
const interactiveEvent = keydown("a", interactiveTarget);
assert.equal(interactiveEvent.defaultPrevented, false, "shortcuts targeted at controls must be ignored");
assert.equal(G.getState().current.episodeIndex, 1);

finishRun();
const nextRun = app.querySelectorAll("button").find((button) => button.dataset.action === "next-run");
const registry = app.querySelectorAll("button").find((button) => button.dataset.action === "registry");
for (const key of ["Enter", " "]) {
  const nextEvent = keydown(key, nextRun);
  assert.equal(nextEvent.defaultPrevented, false, `${key} on next-run must remain native`);
  assert.equal(G.getState().current, null, `${key} on next-run must not trigger the global shortcut`);
  const registryEvent = keydown(key, registry);
  assert.equal(registryEvent.defaultPrevented, false, `${key} on registry must remain native`);
  assert.equal(G.getState().current, null, `${key} on registry must not start another run`);
}

click(nextRun);
assert.ok(G.getState().current, "native-like next-run click should start another run");
finishRun();
const endingRegistry = app.querySelectorAll("button").find((button) => button.dataset.action === "registry");
click(endingRegistry);
assert.equal(G.getState().current, null, "registry click should leave the run inactive");
assert.ok(app.querySelector("#registry-title"), "registry click should render the registry screen");

console.log("Checkpoint UI behavior passed.");
