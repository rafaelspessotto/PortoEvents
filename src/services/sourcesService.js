const fs = require("fs/promises");
const path = require("path");

const SOURCES_PATH = path.join(__dirname, "..", "config", "sources.json");

async function getSources() {
  const raw = await fs.readFile(SOURCES_PATH, "utf-8");
  return JSON.parse(raw);
}

async function saveSources(sources) {
  await fs.writeFile(SOURCES_PATH, `${JSON.stringify(sources, null, 2)}\n`, "utf-8");
}

module.exports = {
  getSources,
  saveSources,
  SOURCES_PATH,
};
