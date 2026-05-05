import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";

// Allow up to 45 seconds — screenshots of large pages can be slow
export const config = { maxDuration: 45 };

export default async function handler(req, res) {
  const url    = req.query?.url;
  const ua     = req.query?.ua;
  const mobile = req.query?.mobile === "1";
  if (!url) {
    res.status(400).json({ error: "url parameter required" });
    return;
  }

  const viewW = mobile ? 390  : 1440;
  const viewH = mobile ? 844  : 900;
  const maxH  = mobile ? 2500 : 2000;

  let browser;
  try {
    browser = await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const mobileUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

    const page = await browser.newPage();
    if (ua) await page.setUserAgent(ua);
    else if (mobile) await page.setUserAgent(mobileUA);
    await page.setViewport({ width: viewW, height: viewH, isMobile: mobile, hasTouch: mobile });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Wait for JS-rendered content to settle after network is quiet
    await page.evaluate(() => new Promise(resolve => {
      if (document.readyState === "complete") return resolve();
      window.addEventListener("load", resolve, { once: true });
    }));
    await new Promise(r => setTimeout(r, 2500));

    const captureH = await page.evaluate((max) =>
      Math.min(document.body.scrollHeight, max), maxH
    );
    await page.setViewport({ width: viewW, height: captureH, isMobile: mobile, hasTouch: mobile });
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
