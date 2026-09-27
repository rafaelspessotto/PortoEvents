const express = require("express");
const path = require("path");
const { readEventsFile } = require("./services/eventsStore");
const { scrapeAllEnabledSources } = require("./services/scrapeService");
const { getSources, saveSources } = require("./services/sourcesService");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const MAIN_DIR = path.join(PUBLIC_DIR, "main");
const AUTO_REFRESH_MS = 10 * 60 * 1000;
const DEMO_DISABLE_REFRESH = true;

let refreshInFlight = false;

app.use(express.json());
app.use(express.static(PUBLIC_DIR, { index: false }));
app.use("/assets", express.static(path.join(MAIN_DIR, "assets")));
app.use("/vendor", express.static(path.join(MAIN_DIR, "vendor")));

app.get("/support.js", (req, res) => {
  res.sendFile(path.join(MAIN_DIR, "support.js"));
});

app.get("/", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.sendFile(path.join(MAIN_DIR, "Main.dc.html"));
});

app.get("/app", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

function filterByDate(events, date) {
  if (!date) return events;

  return events.filter((event) => {
    if (!event.startDate) return false;
    if (!event.endDate) return event.startDate === date;
    return event.startDate <= date && date <= event.endDate;
  });
}

async function runScheduledRefresh(trigger) {
  if (DEMO_DISABLE_REFRESH) {
    console.log(`[auto-refresh] Skipped via ${trigger}; demo mode is enabled`);
    return;
  }

  if (refreshInFlight) {
    console.log(`[auto-refresh] Ignored ${trigger}; refresh already in progress`);
    return;
  }

  refreshInFlight = true;

  try {
    const payload = await scrapeAllEnabledSources();
    console.log(
      `[auto-refresh] Completed via ${trigger}: ${payload.events.length} events from ${payload.sourceCount} sources`,
    );
  } catch (error) {
    console.error(`[auto-refresh] Failed via ${trigger}:`, error.message);
  } finally {
    refreshInFlight = false;
  }
}

function startAutoRefresh() {
  if (DEMO_DISABLE_REFRESH) return;

  setInterval(() => {
    runScheduledRefresh("interval");
  }, AUTO_REFRESH_MS);
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.get("/api/sources", async (req, res) => {
  const sources = await getSources();
  res.json(sources);
});

app.post("/api/sources", async (req, res) => {
  const { id, name, url, city, scraper, enabled, maxItems } = req.body;

  if (!id || !name || !url || !scraper) {
    return res.status(400).json({ error: "Campos obrigatorios: id, name, url, scraper" });
  }

  const sources = await getSources();
  const index = sources.findIndex((source) => source.id === id);

  const nextSource = {
    id,
    name,
    url,
    city: city || "Porto",
    scraper,
    enabled: enabled !== false,
    maxItems: Number.isFinite(maxItems) ? maxItems : 60,
  };

  if (index >= 0) {
    sources[index] = nextSource;
  } else {
    sources.push(nextSource);
  }

  await saveSources(sources);
  return res.status(201).json(nextSource);
});

app.delete("/api/sources/:id", async (req, res) => {
  const { id } = req.params;
  const sources = await getSources();
  const filtered = sources.filter((source) => source.id !== id);

  if (filtered.length === sources.length) {
    return res.status(404).json({ error: "Fonte nao encontrada" });
  }

  await saveSources(filtered);
  return res.status(204).send();
});

app.get("/api/events", async (req, res) => {
  const { date } = req.query;
  const payload = await readEventsFile();
  const filtered = filterByDate(payload.events, date);

  res.json({
    lastUpdated: payload.lastUpdated,
    count: filtered.length,
    events: filtered,
  });
});

app.post("/api/events/refresh", async (req, res) => {
  if (DEMO_DISABLE_REFRESH) {
    return res.status(403).json({ error: "Refresh disabled for demo mode" });
  }

  try {
    const payload = await scrapeAllEnabledSources();
    res.json({
      lastUpdated: payload.lastUpdated,
      count: payload.events.length,
      sourceCount: payload.sourceCount,
      errors: payload.errors,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`PortoEvents a correr em http://localhost:${PORT}`);
  startAutoRefresh();
  runScheduledRefresh("startup");
});
