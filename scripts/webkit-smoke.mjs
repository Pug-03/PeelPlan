// Loads pages in WebKit (Safari's engine) and fails on hydration errors. Needs a running server.
// Chromium shares V8 with the Node SSR, so engine-specific mismatches only show up here.
// Usage: pnpm smoke:webkit [url ...]   (default: http://localhost:3000/)
import { webkit } from "playwright-core";

const urls = process.argv.slice(2).length ? process.argv.slice(2) : ["http://localhost:3000/"];
const browser = await webkit.launch();
let failed = false;
for (const url of urls) {
  const page = await browser.newPage(); // fresh context, so no stale cached chunks
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /hydrat/i.test(m.text())) errors.push(m.text().slice(0, 2000));
  });
  page.on("pageerror", (e) => {
    if (/hydrat/i.test(e.message)) errors.push(e.message.slice(0, 2000));
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  console.log(errors.length ? `✗ ${url}\n${errors.join("\n---\n")}` : `✓ ${url}`);
  failed ||= errors.length > 0;
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
