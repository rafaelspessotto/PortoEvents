const fs = require("fs/promises");
const path = require("path");

const EVENTS_PATH = path.join(__dirname, "..", "..", "data", "events.json");

async function readEventsFile() {
  try {
    const raw = await fs.readFile(EVENTS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.events)) {
      return { lastUpdated: null, events: [] };
    }
    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") {
      return { lastUpdated: null, events: [] };
    }
    throw error;
  }
}

async function saveEvents(events) {
  const payload = {
    lastUpdated: new Date().toISOString(),
    events,
  };

  await fs.writeFile(EVENTS_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  return payload;
}

module.exports = {
  readEventsFile,
  saveEvents,
  EVENTS_PATH,
};
