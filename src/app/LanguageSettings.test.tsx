// @vitest-environment jsdom
import { ProfileFields } from "../features/communities/ProfileFields";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LANGUAGE_KEY, localization } from "../features/localization/service";
import { ToastProvider } from "../shared/design-system/ui/Toast";
import { LanguageSettings } from "./LanguageSettings";

beforeEach(() => {
  localization.setLocale("en-US");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localization.setLocale("en-US");
  localStorage.clear();
});

it("switches language immediately and saves the device preference", async () => {
  const user = userEvent.setup();
  render(<LanguageSettings />);
  await user.click(screen.getByRole("combobox", { name: "App language" }));
  const chinese = await screen.findByRole("option", { name: "简体中文" });
  expect(chinese).toHaveAttribute("lang", "zh-CN");
  await user.click(chinese);
  expect(screen.getByRole("heading", { name: "语言" })).toBeVisible();
  expect(screen.getByRole("combobox", { name: "应用语言" })).toHaveTextContent(
    "简体中文",
  );
  expect(localStorage.getItem(LANGUAGE_KEY)).toBe("zh-CN");
});

it("retains an unsaved language and retries without losing the active choice", async () => {
  const user = userEvent.setup();
  const save = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Storage unavailable");
  });
  render(
    <ToastProvider>
      <LanguageSettings />
    </ToastProvider>,
  );
  await user.click(screen.getByRole("combobox", { name: "App language" }));
  await user.click(await screen.findByRole("option", { name: "简体中文" }));
  const notice = await screen.findByRole("dialog", {
    name: "未能保存语言设置",
  });
  expect(notice).toHaveAttribute("lang", "zh-CN");
  expect(localization.unsaved()).toBe(true);
  save.mockRestore();
  await user.click(screen.getByRole("button", { name: "重试保存语言" }));
  expect(localStorage.getItem(LANGUAGE_KEY)).toBe("zh-CN");
  expect(localization.unsaved()).toBe(false);
  expect(screen.getByRole("combobox", { name: "应用语言" })).toHaveFocus();
  expect(
    screen.queryByRole("dialog", { name: "未能保存语言设置" }),
  ).not.toBeInTheDocument();
});

it("refreshes the mounted page when another window saves a language", async () => {
  render(<LanguageSettings />);
  await act(async () => {
    localStorage.setItem(LANGUAGE_KEY, "zh-CN");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: LANGUAGE_KEY,
        storageArea: localStorage,
      }),
    );
  });
  expect(screen.getByRole("heading", { name: "语言" })).toBeVisible();
  expect(screen.getByRole("region", { name: "语言" })).toHaveAttribute(
    "lang",
    "zh-CN",
  );
});

it("changes form labels without translating or resetting user-written profile content", async () => {
  const onChange = vi.fn();
  render(
    <ProfileFields
      profile={{
        name: "Alice 中文",
        picture: "",
        about: "Keep my English text.",
      }}
      onChange={onChange}
      showAvatar={false}
    />,
  );
  await act(async () => {
    localization.setLocale("zh-CN");
  });
  expect(screen.getByRole("textbox", { name: "显示名称" })).toHaveValue(
    "Alice 中文",
  );
  expect(screen.getByRole("textbox", { name: "个人简介（可选）" })).toHaveValue(
    "Keep my English text.",
  );
  expect(onChange).not.toHaveBeenCalled();
});
