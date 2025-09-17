const fs = require("fs");
(async () => {
  try {
    const puppeteer = require("puppeteer"); // tam paket
    console.log(
      "puppeteer.executablePath():",
      puppeteer.executablePath && puppeteer.executablePath()
    );

    const execPath = puppeteer.executablePath && puppeteer.executablePath();
    console.log(
      "exists execPath:",
      execPath ? fs.existsSync(execPath) : "no execPath"
    );

    const browser = await puppeteer.launch({
      // executablePath: execPath || undefined,
      headless: true,
      dumpio: true, // chromium stderr/stdout'u konsola basar
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process",
      ],
      timeout: 60000,
    });

    const page = await browser.newPage();
    await page.goto("https://example.com", {
      waitUntil: "load",
      timeout: 30000,
    });
    console.log("Title:", await page.title());
    await browser.close();
    console.log("OK");
  } catch (e) {
    console.error("LAUNCH-TEST-ERROR:", e);
    process.exit(1);
  }
})();
