// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { localization } from "../localization/service";
import { DefaultLifetimeSettings } from "./DefaultLifetimeSettings";
import { readDefaultLifetime } from "./default-lifetime";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localization.setLocale("en-US");
  localStorage.clear();
});

it("stores the original seconds when a Chinese duration is chosen", async () => {
  localization.setLocale("zh-CN");
  const user = userEvent.setup();
  const scope = "duration-chinese-success";
  render(<DefaultLifetimeSettings scope={scope} />);
  await user.click(screen.getByRole("combobox", { name: "新建个人对话" }));
  await user.click(
    await screen.findByRole("option", { name: "临时保留，7天" }),
  );
  expect(readDefaultLifetime(scope)).toBe(604800);
  await act(async () => {
    localization.setLocale("en-US");
  });
  expect(
    screen.getByRole("combobox", { name: "New Solo chats" }),
  ).toHaveTextContent("Temporary, 7 days");
  expect(readDefaultLifetime(scope)).toBe(604800);
});

it("updates a save error when the interface language changes", async () => {
  localization.setLocale("en-US");
  const user = userEvent.setup();
  render(<DefaultLifetimeSettings scope="duration-failed-save" />);
  const save = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("denied");
  });
  await user.click(screen.getByRole("combobox", { name: "New Solo chats" }));
  await user.click(
    await screen.findByRole("option", {
      name: "Temporary, 1 day",
    }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Couldn’t save this on this device. Try again.",
  );
  save.mockRestore();
  await act(async () => {
    localization.setLocale("zh-CN");
  });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "无法保存到此设备，请重试。",
  );
});
