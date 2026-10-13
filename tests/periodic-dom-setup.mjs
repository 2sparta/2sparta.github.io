import "./atlas-dom-setup.mjs";
// TanStack's development export detects this DOM; Node's default export is SSR.
globalThis.self = window;
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
window.scrollTo = () => {};
globalThis.scrollTo = window.scrollTo;
