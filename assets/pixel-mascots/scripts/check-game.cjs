const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const output =
  process.env.PIXEL_CHECK_OUTPUT || path.resolve(__dirname, "../../../.tmp/pixel-check");
require("node:fs").mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.log(e.stack);
    });
    page.on("response", (r) => {
      if (r.status() >= 400) {
        errors.push(`${r.status()} ${r.url()}`);
        console.log(errors.at(-1));
      }
    });
    await page.goto(process.env.PIXEL_PREVIEW_URL || "http://127.0.0.1:18903/dev/pixels.html");
    await page.waitForFunction(() => window.pixelPreview);
    await page.waitForTimeout(1400);
    await page.screenshot({ path: path.join(output, "pixels-desktop.png") });
    await page.selectOption("#character", "ai-musespark");
    await page.click("#battle");
    await page.waitForTimeout(600);
    await page.click("#play");
    await page.evaluate(() => window.pixelPreview.setView({ timeMs: 10000, running: false }));
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(output, "pixels-battle.png") });
    const paused = await page.locator("canvas").screenshot();
    await page.waitForTimeout(250);
    assert.deepEqual(
      await page.locator("canvas").screenshot(),
      paused,
      "paused replay must not keep animating",
    );
    await page.evaluate(() => window.pixelPreview.setView({ timeMs: 0, running: false }));
    await page.click("#deploy");
    // Pointer positions use the same scene coordinates as the renderer; verify real drag callbacks.
    async function pt(x, y) {
      return page.evaluate(
        ({ x, y }) => {
          return window.pixelPreview.screenPoint({ x, y });
        },
        { x, y },
      );
    }
    async function drag(a, b) {
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 10 });
      await page.mouse.up();
    }
    await page.click("#zoom-in");
    assert.equal(await page.locator("#zoom-level").textContent(), "125%");
    await page.click("#zoom-out");
    assert.equal(await page.locator("#zoom-level").textContent(), "100%");
    await page.mouse.move(640, 450);
    await page.mouse.wheel(0, -100);
    await page.waitForFunction(() => Number(document.querySelector("canvas").dataset.zoom) > 1.2);
    const beforePan = await pt(320, 360);
    await drag(await pt(15, 300), await pt(65, 330));
    const afterPan = await pt(320, 360);
    assert.ok(afterPan.x > beforePan.x + 30, "blank-space drag pans the board");
    await page.click("#fit");
    // Deployment must still hit the correct cell with a non-default zoom.
    await page.click("#zoom-in");
    const atCell = (row, col) => page.evaluate(({row,col}) => window.pixelPreview.screenCell(row,col), {row,col});
    const atBench = (index) => page.evaluate(index => window.pixelPreview.screenBench(index), index);
    const bench = await atBench(0),
      cell = await atCell(7, 0);
    await drag(bench, cell);
    assert.equal(
      await page.evaluate(() =>
        window.pixelPreview.props.board.some(
          (p) => p.id === "bench-0" && p.localRow === 0 && p.localCol === 0,
        ),
      ),
      true,
    );
    // Enemy half cannot accept our piece.
    const count = await page.evaluate(() => window.pixelPreview.notes.length);
    await drag(await atCell(7, 0), await atCell(0, 0));
    assert.equal(await page.evaluate(() => window.pixelPreview.notes.length), count);
    // Bench withdrawal and sale use actual pointer dispatch.
    await drag(await atCell(7, 0), await atBench(3));
    assert.equal(
      await page.evaluate(() => window.pixelPreview.props.bench.some((p) => p.id === "bench-0")),
      true,
    );
    const sell = await page.locator("#sell").boundingBox();
    await drag(await atBench(2), { x: sell.x + sell.width / 2, y: sell.y + sell.height / 2 });
    assert.equal(
      await page.evaluate(() => window.pixelPreview.props.bench.some((p) => p.id === "bench-0")),
      false,
    );
    await page.click("#reset");
    await page.click("#fit");
    await page.locator(".pixel-shop-card").first().click();
    assert.equal(await page.locator("#gold").textContent(), "15");
    assert.equal(await page.locator("#bench-count").textContent(), "4");
    assert.equal(await page.locator("#profile-name").textContent(), "Claude");
    await page.click("#refresh-shop");
    assert.equal(await page.locator("#gold").textContent(), "13");
    await page.click("#reset");
    // Pixel controls belong to panels in document flow, with square corners.
    assert.equal(
      await page.locator("#battle").evaluate((el) => getComputedStyle(el).borderRadius),
      "0px",
    );
    assert.equal(await page.locator("#sell").evaluate((el) => !!el.closest(".pixel-action-cell")), true);
    const cdp = await page.context().newCDPSession(page);
    const area = await page.locator("canvas").boundingBox();
    const center = { x: area.x + area.width / 2, y: area.y + area.height / 2 };
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: center.x - 35, y: center.y, id: 1 },
        { x: center.x + 35, y: center.y, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: center.x - 70, y: center.y, id: 1 },
        { x: center.x + 70, y: center.y, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    assert.ok(
      Number(await page.locator("canvas").getAttribute("data-zoom")) > 1.5,
      "two-finger pinch zooms",
    );
    await page.click("#fit");
    for (const size of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(250);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollHeight > innerHeight),
        false,
        "mobile game fits one screen",
      );
      const ready = await page.locator("#battle").boundingBox();
      assert.ok(
        ready.y >= 0 && ready.y + ready.height <= size.height,
        "ready button remains on screen",
      );
      await page.getByRole("button", { name: "玩家与羁绊", exact: true }).click();
      assert.ok(await page.getByLabel("玩家与羁绊面板", { exact: true }).isVisible());
      await page.getByRole("button", { name: "返回棋盘 ×", exact: true }).click();
      assert.equal(await page.getByLabel("玩家与羁绊面板", { exact: true }).isVisible(), false);
      await page.screenshot({ path: path.join(output, `pixels-${size.width}.png`) });
    }
    // Every atlas is requested through the runtime path.
    const assets = await page.evaluate(async () => {
      const m = await (await fetch("/pixel-mascots/manifest.json")).json();
      return Promise.all(
        m.units.map(async (u) => {
          const im = new Image();
          im.src = "/pixel-mascots/" + u.atlas;
          await im.decode();
          return [u.id, im.width, im.height];
        }),
      );
    });
    assert.equal(assets.length, 29);
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log(
      JSON.stringify({
        canvas: "2d",
        characters: assets.length,
        drag: "pass",
        enemyDrop: "rejected",
        bench: "pass",
        sale: "pass",
        zoom: "buttons, wheel, pan, reset and zoomed deployment passed",
        viewports: [1280, 390, 844],
        errors,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
