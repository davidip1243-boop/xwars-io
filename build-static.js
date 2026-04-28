const fs = require("fs");
const path = require("path");

const output = path.join(__dirname, "dist");
fs.rmSync(output, { force: true, recursive: true });
fs.mkdirSync(output, { recursive: true });

for (const file of ["index.html", "styles.css", "game.js", "online-config.js", "vercel.json"]) {
  fs.copyFileSync(path.join(__dirname, file), path.join(output, file));
}
