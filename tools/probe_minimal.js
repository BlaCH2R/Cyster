const { app } = require("electron");
const fs = require("path") && require("fs");
app.whenReady().then(() => {
  fs.writeFileSync("V:/cytoid storyboarder/tools/probe_minimal_out.txt", "ok " + Date.now());
  app.exit(0);
});
