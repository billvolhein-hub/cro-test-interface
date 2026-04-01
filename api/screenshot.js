import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";

// Allow up to 45 seconds — screenshots of large pages can be slow
export const config = { maxDuration: 45 };

export default async function handler(req, res) {
  const url = req.query?.url;
  if (!url) {
    res.status(400).json({ error: "url parameter required" });
    return;
  }

  let browser;
  try {
    browser = await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Wait for JS-rendered content to settle after network is quiet
    await page.evaluate(() => new Promise(resolve => {
      if (document.readyState === "complete") return resolve();
      window.addEventListener("load", resolve, { once: true });
    }));
    await new Promise(r => setTimeout(r, 2500));

    const captureH = await page.evaluate(() =>
      Math.min(document.body.scrollHeight, 2000)
    );
    await page.setViewport({ width: 1440, height: captureH });
    await new Promise(r => setTimeout(r, 500));

    const buf = await page.screenshot({ type: "jpeg", quality: 82 });
    await browser.close();

    const dataUrl = `data:image/jpeg;base64,${Buffer.from(buf).toString("base64")}`;
    res.status(200).json({ dataUrl });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    res.status(500).json({ error: err.message });
  }
}
