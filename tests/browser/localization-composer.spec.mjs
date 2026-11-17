import { test, expect } from "./playwright-test.mjs";
import { createServer, warmUp } from "./vite-server.mjs";
import react from "@vitejs/plugin-react";

// The real editor proves native focus/selection, undo, formatting, and IME event
// boundaries survive a locale change. Relay fixture records the exact payload.
test("Chinese composer preserves native editing through language changes and sends the original content", async ({
  page,
}) => {
  const server = await createServer({
    configFile: false,
    envFile: false,
    plugins: [react()],
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  try {
    await warmUp(server, "/tests/fixtures/link-messages.html");
    await page.addInitScript(() =>
      localStorage.setItem("buzz-language.v1", "zh-CN"),
    );
    await page.goto(
      `http://127.0.0.1:${server.httpServer.address().port}/tests/fixtures/link-messages.html`,
    );
    const editor = page.getByRole("textbox", {
      name: "发送消息到 #design",
      exact: true,
    });
    await expect(editor).toBeVisible();
    const original = await editor.elementHandle();
    await editor.fill("中文 draft");
    await editor.evaluate((element) => element.setSelectionRange(0, 2));
    await page
      .getByRole("button", { name: "切换格式工具", exact: true })
      .click();
    await page.getByRole("button", { name: "加粗", exact: true }).click();
    await expect(editor.locator("strong")).toHaveText("中文");
    await editor.press("ControlOrMeta+z");
    await expect(editor.locator("strong")).toHaveCount(0);
    await editor.press("ControlOrMeta+Shift+z");
    await expect(editor.locator("strong")).toHaveText("中文");
    await editor.evaluate((element) => element.setSelectionRange(0, 2));
    await page.evaluate(() => {
      localStorage.setItem("buzz-language.v1", "en-US");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "buzz-language.v1",
          storageArea: localStorage,
        }),
      );
    });
    const english = page.getByRole("textbox", {
      name: "Message #design",
      exact: true,
    });
    await expect(english).toHaveJSProperty("value", "中文 draft");
    expect(
      await english.evaluate(
        (element, previous) => element === previous,
        original,
      ),
    ).toBe(true);
    expect(
      await english.evaluate((element) => [
        element.selectionStart,
        element.selectionEnd,
      ]),
    ).toEqual([0, 2]);
    await expect(english.locator("strong")).toHaveText("中文");
    await page.evaluate(() => {
      localStorage.setItem("buzz-language.v1", "zh-CN");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "buzz-language.v1",
          storageArea: localStorage,
        }),
      );
    });
    await expect(
      page.getByRole("button", { name: "发送消息", exact: true }),
    ).toBeVisible();
    // Explicitly leave the retained bold selection before the plain-text IME case.
    await editor.press("ControlOrMeta+b");
    await expect(editor.locator("strong")).toHaveCount(0);
    await editor.fill("输入法内容");
    await editor.evaluate((element) => {
      element.dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true }),
      );
      element.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          isComposing: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(await page.evaluate(() => window.linkComposerFixture.sent)).toEqual(
      [],
    );
    await editor.evaluate((element) =>
      element.dispatchEvent(
        new CompositionEvent("compositionend", {
          data: "输入法内容",
          bubbles: true,
        }),
      ),
    );
    await expect(editor).toHaveJSProperty("value", "输入法内容");
    await page.getByRole("button", { name: "发送消息", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() => window.linkComposerFixture.sent.at(-1)?.text),
      )
      .toBe("输入法内容");
  } finally {
    await server.close();
  }
});

// Native edit entry must keep the editor node and route through the existing outbox.
test("Chinese message editing keeps the original composer and saved text", async ({
  page,
}) => {
  const server = await createServer({
    configFile: false,
    envFile: false,
    plugins: [react()],
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  try {
    await warmUp(server, "/tests/fixtures/relay-composer.html");
    await page.addInitScript(() =>
      localStorage.setItem("buzz-language.v1", "zh-CN"),
    );
    await page.goto(
      `http://127.0.0.1:${server.httpServer.address().port}/tests/fixtures/relay-composer.html`,
    );
    const input = page.getByRole("textbox", {
      name: "发送消息到 #General",
      exact: true,
    });
    await input.fill("原始中文消息");
    await input.press("Enter");
    await expect
      .poll(() => page.evaluate(() => window.composerFixture.pending()))
      .toEqual([]);
    await expect(input).toHaveJSProperty("value", "");
    const original = await input.elementHandle();
    await input.press("Meta+ArrowUp");
    const editor = page.getByRole("textbox", { name: "编辑消息", exact: true });
    await expect(editor).toBeFocused();
    expect(
      await editor.evaluate(
        (element, previous) => element === previous,
        original,
      ),
    ).toBe(true);
    await expect(editor).toHaveJSProperty("value", "原始中文消息");
    await editor.fill("修改后的中文消息");
    await page.getByRole("button", { name: "保存修改", exact: true }).click();
    await expect(input).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => window.composerFixture.pending()))
      .toEqual([]);
    await expect(
      page.getByText("修改后的中文消息 (edited)", { exact: true }),
    ).toBeVisible();
  } finally {
    await server.close();
  }
});
