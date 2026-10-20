// Test-only network stubs. Production branding and font loading are unchanged.
import { chromium } from "playwright";
const launch = chromium.launch.bind(chromium);
chromium.launch = async (options) => {
  const browser = await launch(options);
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async (options) => {
    const page = await newPage(options);
    await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
    await page.route("https://grok.com/grok-app-builder/extensions.js", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
    const goto = page.goto.bind(page);
    page.goto = async (...args) => {
      const response = await goto(...args);
      await page.getByRole("button", { name: "Увійти", exact: true }).waitFor({ state: "visible", timeout: 12000 }).catch(() => {});
      return response;
    };
    return page;
  };
  return browser;
};
