import { stopRoutes } from "./playwright-test.mjs";
import { test, expect } from "./fixture.mjs";
import {
  activate,
  openSettings,
  selectSettingsSection,
} from "./navigation.mjs";

test.use({ historyCounts: { alpha: 1, beta: 0 } });

// A real app and shared browser storage prove cross-window updates and reload
// persistence; component tests cover storage failure and individual controls.
test("Chinese settings persist and synchronize between windows without changing profile text", async ({
  page,
  app,
}) => {
  await page.goto(app.origin);
  await openSettings(page);
  await selectSettingsSection(page, "Profile");
  const displayName = page.getByRole("textbox", {
    name: "Display name",
    exact: true,
  });
  await expect(displayName).toBeEnabled();
  const originalName = await displayName.inputValue();
  await selectSettingsSection(page, "Language");
  await page
    .getByRole("combobox", { name: "App language", exact: true })
    .click();
  await page.getByRole("option", { name: "简体中文", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "语言", exact: true }),
  ).toHaveAttribute("lang", "zh-CN");
  await page.getByRole("button", { name: "个人资料", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "显示名称", exact: true }),
  ).toHaveValue(originalName);
  await page.getByRole("button", { name: "语言", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "应用语言", exact: true }),
  ).toContainText("简体中文");

  await page
    .getByRole("dialog", { name: "设置", exact: true })
    .getByRole("button", { name: "关闭设置", exact: true })
    .click();
  const sidebar = page.getByRole("complementary", {
    name: "侧边栏",
    exact: true,
  });
  const scope = sidebar.getByRole("tablist", { name: "导航范围", exact: true });
  await expect(scope).toHaveAttribute("lang", "zh-CN");
  await expect(
    scope.getByRole("tab", { name: "全部", exact: true }),
  ).toBeVisible();
  await scope.getByRole("tab", { name: "团队", exact: true }).click();
  await expect(
    scope.getByRole("tab", { name: "团队", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await scope.getByRole("tab", { name: "全部", exact: true }).click();
  await page.getByRole("button", { name: "你的个人资料", exact: true }).click();
  await page.getByRole("menuitem", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "语言", exact: true }).click();

  const second = await page.context().newPage();
  try {
    await second.goto(page.url());
    await activate(
      second.getByRole("combobox", { name: "应用语言", exact: true }),
    );
    await second
      .getByRole("option", { name: "English (United States)", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Language", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "App language", exact: true }),
    ).toContainText("English (United States)");
  } finally {
    await stopRoutes(page.context());
    await second.close();
  }
});

// Real layout, popup focus, and the app's interface scaling need a browser.
test("Chinese language controls remain reachable at narrow width and 200 percent size", async ({
  page,
  app,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("buzz-language.v1", "zh-CN");
    localStorage.setItem("buzz-font-scale.v1", "2");
  });
  await page.setViewportSize({ width: 480, height: 800 });
  await page.goto(app.origin);
  await page.getByRole("button", { name: "你的个人资料", exact: true }).click();
  await page.getByRole("menuitem", { name: "设置", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "设置", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "语言", exact: true }).click();
  const region = page.getByRole("region", { name: "语言", exact: true });
  const language = region.getByRole("combobox", {
    name: "应用语言",
    exact: true,
  });
  await language.focus();
  await language.press("ArrowDown");
  await expect(
    page.getByRole("option", { name: "简体中文", exact: true }),
  ).toHaveAttribute("lang", "zh-CN");
  await expect
    .poll(() =>
      page.evaluate(
        () => !!document.activeElement?.closest('[role="listbox"]'),
      ),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(language).toBeFocused();
  await expect
    .poll(() =>
      region.evaluate((element) => element.scrollWidth <= element.clientWidth),
    )
    .toBe(true);
  await expect(language).toBeInViewport();
});
