const { getSources } = require("./sourcesService");
const { saveEvents } = require("./eventsStore");
const { scrapeAgendaPorto } = require("../scrapers/agendaPorto");

const SCRAPERS = {
  "agenda-porto": scrapeAgendaPorto,
};

function dedupeEvents(events) {
  const byId = new Map();
  for (const event of events) {
    byId.set(event.id, event);
  }
  return Array.from(byId.values());
}

async function scrapeAllEnabledSources() {
  const sources = await getSources();
  const enabled = sources.filter((source) => source.enabled);

  const allEvents = [];
  const errors = [];

  for (const source of enabled) {
    const scraper = SCRAPERS[source.scraper];
    if (!scraper) {
      errors.push({ sourceId: source.id, error: `Scraper '${source.scraper}' nao encontrado` });
      continue;
    }

    try {
      const sourceEvents = await scraper(source);
      allEvents.push(...sourceEvents);
    } catch (error) {
      errors.push({ sourceId: source.id, error: error.message });
    }
  }

  const deduped = dedupeEvents(allEvents).sort((a, b) => {
    const dateA = a.startDate || "9999-12-31";
    const dateB = b.startDate || "9999-12-31";
    return dateA.localeCompare(dateB) || a.title.localeCompare(b.title);
  });

  const payload = await saveEvents(deduped);

  return {
    ...payload,
    sourceCount: enabled.length,
    errors,
  };
}

module.exports = {
  scrapeAllEnabledSources,
};
