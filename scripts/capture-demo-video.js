const fs = require("fs/promises");
const path = require("path");
const puppeteer = require("puppeteer-core");

const BASE_URL = "http://127.0.0.1:3000";
const OUTPUT_DIR = path.join(__dirname, "..", "artifacts", "demo-video");
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, "screenshots");
const CHROME_PATH = process.env.CHROME_BIN || "/usr/bin/google-chrome";

const SHOTS = [
  { name: "01-landing.png", duration: 2.2 },
  { name: "02-sign-up.png", duration: 2.0 },
  { name: "03-wizard.png", duration: 2.2 },
  { name: "04-events-home.png", duration: 2.4 },
  { name: "05-more-events.png", duration: 2.2 },
  { name: "06-profile-menu.png", duration: 1.8 },
  { name: "07-profile-page.png", duration: 2.4 },
];

async function ensureDirs() {
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
}

async function waitForVisible(page, id) {
  await page.waitForFunction((targetId) => {
    const node = document.getElementById(targetId);
    return node && !node.classList.contains("hidden");
  }, {}, id);
}

async function screenshot(page, fileName) {
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, fileName),
    type: "png",
    captureBeyondViewport: false,
  });
}

async function writeConcatManifest() {
  const lines = [];

  for (const shot of SHOTS) {
    const filePath = path.join(SCREENSHOTS_DIR, shot.name).replace(/'/g, "'\\''");
    lines.push(`file '${filePath}'`);
    lines.push(`duration ${shot.duration}`);
  }

  const last = path.join(SCREENSHOTS_DIR, SHOTS[SHOTS.length - 1].name).replace(/'/g, "'\\''");
  lines.push(`file '${last}'`);

  await fs.writeFile(path.join(OUTPUT_DIR, "frames.txt"), `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  await ensureDirs();

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME_PATH,
    defaultViewport: { width: 1440, height: 1024, deviceScaleFactor: 1 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle0" });
    await screenshot(page, SHOTS[0].name);

    await page.goto(`${BASE_URL}/app`, { waitUntil: "networkidle0" });
    await waitForVisible(page, "authScreen");
    await page.hover(".login-submit");
    await screenshot(page, SHOTS[1].name);

    await page.click(".login-submit");
    await waitForVisible(page, "onboardingScreen");
    await page.click("#onboardingPrefsGrid .pref-item:nth-child(1)");
    await page.click("#onboardingPrefsGrid .pref-item:nth-child(2)");
    await page.click("#onboardingPrefsGrid .pref-item:nth-child(4)");
    await screenshot(page, SHOTS[2].name);

    await page.click("#finishOnboardingBtn");
    await waitForVisible(page, "appShell");
    await page.waitForFunction(() => document.querySelectorAll("#eventsList .event-row").length > 0);
    await screenshot(page, SHOTS[3].name);

    await page.click("#moreEventsBtn");
    await page.waitForFunction(() => document.querySelectorAll("#eventsList .event-row").length > 8);
    await page.evaluate(() => window.scrollTo({ top: 650, behavior: "instant" }));
    await page.waitForFunction(() => window.scrollY >= 600);
    await screenshot(page, SHOTS[4].name);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.click("#profileMenuTrigger");
    await page.waitForFunction(() => !document.getElementById("profileDropdown").classList.contains("hidden"));
    await screenshot(page, SHOTS[5].name);

    await page.click("#profileDropdown .nav-menu-item[data-screen='profile']");
    await waitForVisible(page, "screenProfile");
    await screenshot(page, SHOTS[6].name);

    await writeConcatManifest();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});