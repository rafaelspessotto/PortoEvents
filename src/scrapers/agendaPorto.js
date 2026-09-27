const axios = require("axios");
const cheerio = require("cheerio");
const crypto = require("crypto");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");

dayjs.extend(customParseFormat);

const MONTHS = {
  Jan: "01",
  Fev: "02",
  Mar: "03",
  Abr: "04",
  Mai: "05",
  Jun: "06",
  Jul: "07",
  Ago: "08",
  Set: "09",
  Out: "10",
  Nov: "11",
  Dez: "12",
};

function makeAbsoluteUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return new URL(url, "https://www.agenda-porto.pt").toString();
}

function normalizeText(value) {
  return value ? value.replace(/\s+/g, " ").trim() : "";
}

function buildId(sourceId, url) {
  return crypto.createHash("sha1").update(`${sourceId}:${url}`).digest("hex");
}

function parseDateLabelToISO(dateLabel) {
  if (!dateLabel) return null;

  const exactDate = dayjs(dateLabel, "DD/MM/YYYY", true);
  if (exactDate.isValid()) {
    return exactDate.format("YYYY-MM-DD");
  }

  const match = dateLabel.match(/(\d{1,2})\s([A-Za-zÀ-ÿ]{3})\s?(\d{4})?/i);
  if (!match) return null;

  const [, day, monthLabel, yearFromText] = match;
  const month = MONTHS[monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1, 3).toLowerCase()];
  const year = yearFromText || String(new Date().getFullYear());

  if (!month) return null;
  return `${year}-${month}-${day.padStart(2, "0")}`;
}

function extractDateTokens(text) {
  if (!text) return [];
  const matches = text.match(/\d{1,2}\s(?:Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)(?:\s\d{4})?/g);
  return matches ? matches.map((item) => normalizeText(item)) : [];
}

function parseDateToken(token, yearFallback = null) {
  if (!token) return null;
  const hasYear = /\d{4}$/.test(token);
  const normalized = hasYear || !yearFallback ? token : `${token} ${yearFallback}`;
  return parseDateLabelToISO(normalized);
}

function parseDateRangeFromText(text) {
  const tokens = extractDateTokens(text);
  if (!tokens.length) {
    return { startDate: null, endDate: null, dateLabel: null };
  }

  if (tokens.length === 1) {
    const onlyDate = parseDateToken(tokens[0]);
    return {
      startDate: onlyDate,
      endDate: onlyDate,
      dateLabel: tokens[0],
    };
  }

  const first = tokens[0];
  const second = tokens[1];
  const secondYear = second.match(/(\d{4})$/)?.[1] || null;
  const startDate = parseDateToken(first, secondYear);
  const endDate = parseDateToken(second);

  return {
    startDate,
    endDate: endDate || startDate,
    dateLabel: `${first} ${second}`,
  };
}

function extractListingHints($) {
  const hints = new Map();

  $("a[href*='evento/']").each((_, element) => {
    const eventUrl = makeAbsoluteUrl($(element).attr("href"));
    if (!eventUrl || hints.has(eventUrl)) return;

    const card = $(element).closest("div[data-bl-name='Card. Card Event']");
    let title = null;
    let venue = null;
    let startDate = null;
    let endDate = null;
    let dateLabel = null;

    if (card.length) {
      title = normalizeText(card.find("div[data-bl-name='Title']").first().text()) || null;
      venue = normalizeText(card.find("div[data-bl-name='Local'] a").first().text()) || null;

      const startToken = normalizeText(
        card
          .find("div[data-bl-name='Start Date'] .bl-text")
          .toArray()
          .map((node) => $(node).text())
          .join(" "),
      );
      const endToken = normalizeText(
        card
          .find("div[data-bl-name='End Date'] .bl-text")
          .toArray()
          .map((node) => $(node).text())
          .join(" "),
      );
      const yearToken = normalizeText(card.find("div[data-bl-name='Year']").first().text());

      if (startToken) {
        startDate = parseDateLabelToISO(`${startToken} ${yearToken}`.trim());
      }
      if (endToken) {
        endDate = parseDateLabelToISO(`${endToken} ${yearToken}`.trim());
      }
      if (startToken || endToken) {
        dateLabel = `${startToken}${endToken ? ` ${endToken}` : ""}${yearToken ? ` ${yearToken}` : ""}`;
      }
    }

    if (!card.length || (!startDate && !title && !venue)) {
      const container = $(element).closest("[data-content-id]");
      const scope = container.length ? container : $(element).parent();
      const scopeText = normalizeText(scope.text());
      const dateRange = parseDateRangeFromText(scopeText);

      if (!title) {
        title = normalizeText(scope.find("img[alt]").first().attr("alt")) || null;
      }
      if (!venue) {
        venue = normalizeText(scope.find("a[href*='local/']").first().text()) || null;
      }
      startDate = startDate || dateRange.startDate;
      endDate = endDate || dateRange.endDate;
      dateLabel = dateLabel || dateRange.dateLabel;
    }

    hints.set(eventUrl, {
      title,
      venue,
      startDate,
      endDate,
      dateLabel,
    });
  });

  return hints;
}

function extractEventFromJsonLd($) {
  const scripts = $("script[type='application/ld+json']").toArray();

  for (const script of scripts) {
    const raw = $(script).contents().text();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const type = item["@type"];
        if (type === "Event") {
          return item;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function fetchEventDetails(link, source, hint = {}) {
  const response = await axios.get(link, {
    timeout: 15000,
    headers: {
      "User-Agent": "PortoEventsBot/1.0 (+https://localhost)",
      "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
    },
  });

  const $ = cheerio.load(response.data);

  const jsonLd = extractEventFromJsonLd($);
  const title =
    normalizeText(jsonLd?.name) ||
    normalizeText($("meta[property='og:title']").attr("content")) ||
    normalizeText($("h1").first().text()) ||
    hint.title;

  const description =
    normalizeText(jsonLd?.description) ||
    normalizeText($("meta[name='description']").attr("content")) ||
    normalizeText($("p").first().text());

  const image =
    makeAbsoluteUrl(jsonLd?.image?.url || jsonLd?.image) ||
    makeAbsoluteUrl($("meta[property='og:image']").attr("content"));

  const venue = normalizeText(
    jsonLd?.location?.name || $("a[href*='/local/']").first().text(),
  ) || hint.venue;

  const startDateRaw = jsonLd?.startDate || null;
  const endDateRaw = jsonLd?.endDate || null;
  const startDate = startDateRaw ? dayjs(startDateRaw).format("YYYY-MM-DD") : null;
  const endDate = endDateRaw ? dayjs(endDateRaw).format("YYYY-MM-DD") : null;

  const visualDateLabel = normalizeText(
    $("time").first().text() || $("[class*='date']").first().text(),
  );

  const fallbackDate = parseDateLabelToISO(visualDateLabel);
  const category = normalizeText($("a[href*='/seccao/']").first().text()) || null;

  return {
    id: buildId(source.id, link),
    sourceId: source.id,
    sourceName: source.name,
    city: source.city || "Porto",
    title: title || "Sem título",
    description: description || null,
    venue: venue || null,
    category,
    url: link,
    image,
    startDate: startDate || fallbackDate || hint.startDate || null,
    endDate: endDate || startDate || fallbackDate || hint.endDate || hint.startDate || null,
    dateLabel: visualDateLabel || hint.dateLabel || null,
    scrapedAt: new Date().toISOString(),
  };
}

async function runInBatches(items, worker, batchSize = 6) {
  const result = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const processed = await Promise.all(
      batch.map(async (item) => {
        try {
          return await worker(item);
        } catch {
          return null;
        }
      }),
    );
    result.push(...processed.filter(Boolean));
  }
  return result;
}

async function scrapeAgendaPorto(source) {
  const response = await axios.get(source.url, {
    timeout: 15000,
    headers: {
      "User-Agent": "PortoEventsBot/1.0 (+https://localhost)",
      "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
    },
  });

  const $ = cheerio.load(response.data);
  const hintsByUrl = extractListingHints($);

  const links = $("a[href*='evento/']")
    .toArray()
    .map((el) => makeAbsoluteUrl($(el).attr("href")))
    .filter((link) => Boolean(link));

  const uniqueLinks = [...new Set(links)].slice(0, source.maxItems || 60);
  const events = await runInBatches(
    uniqueLinks,
    (link) => fetchEventDetails(link, source, hintsByUrl.get(link) || {}),
    5,
  );

  return events;
}

module.exports = {
  scrapeAgendaPorto,
};
