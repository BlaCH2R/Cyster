// Playwright + Electron smoke test: launches the real app window and prints its title.
// Run from the app workspace: node ..\tools\playwright_smoke.js
const path = require("path");
const { _electron } = require(path.join(
  __dirname,
  "..",
  "app",
  "node_modules",
  "playwright"
));

(async () => {
  const app = await _electron.launch({
    args: [".", "--no-sandbox", "--disable-gpu"],
    cwd: path.join(__dirname, "..", "app"),
  });
  try {
    const win = await app.firstWindow();
    console.log("WINDOW_TITLE:", await win.title());
  } finally {
    await app.close().catch(() => {});
  }
  console.log("PLAYWRIGHT_ELECTRON_OK");
})().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
