import { register } from "node:module";
import { JSDOM } from "jsdom";
register("./atlas-css-loader.mjs", import.meta.url);
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "https://atlas-test.local",
  pretendToBeVisual: true,
});
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "SVGElement",
  "SVGSVGElement",
  "Element",
  "Node",
  "MutationObserver",
  "getComputedStyle",
])
  Object.defineProperty(globalThis, key, {
    value:
      key === "getComputedStyle" ? dom.window.getComputedStyle.bind(dom.window) : dom.window[key],
    configurable: true,
  });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.SVGSVGElement.prototype.createSVGRect = () => ({});
dom.window.confirm = () => true;
Object.defineProperty(dom.window.HTMLElement.prototype, "clientWidth", {
  get() {
    return 700;
  },
  configurable: true,
});
Object.defineProperty(dom.window.HTMLElement.prototype, "clientHeight", {
  get() {
    return 400;
  },
  configurable: true,
});
Object.defineProperty(dom.window.HTMLElement.prototype, "offsetWidth", {
  get() {
    return 700;
  },
  configurable: true,
});
Object.defineProperty(dom.window.HTMLElement.prototype, "offsetHeight", {
  get() {
    return 400;
  },
  configurable: true,
});
dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({
  left: 0,
  top: 0,
  right: 700,
  bottom: 400,
  width: 700,
  height: 400,
  x: 0,
  y: 0,
  toJSON() {
    return this;
  },
});
