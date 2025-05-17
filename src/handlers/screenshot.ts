import puppeteer from "@cloudflare/puppeteer";

export async function screenshotHandler(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get("url");
  if (!urlParam) {
    return new Response("Missing 'url' parameter", { status: 400 });
  }
  try {
    const normalizedUrl = new URL(urlParam).toString();
    const browser = await puppeteer.launch(env.MYBROWSER);
    const page = await browser.newPage();
    await page.goto(normalizedUrl);
    const img = (await page.screenshot()) as unknown as ArrayBuffer;
    await browser.close();
    return new Response(img, {
      headers: { "Content-Type": "image/jpeg" },
    });
  } catch (err) {
    console.error("Screenshot error:", err);
    return new Response("Failed to capture screenshot", { status: 500 });
  }
}