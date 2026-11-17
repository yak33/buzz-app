// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { TimeZoneField } from "./TimeZoneField";
import { localization } from "../localization/service";

afterEach(() => {
  cleanup();
  localization.setLocale("en-US");
});

// Engines list one spelling of a renamed zone: V8 (these tests) lists only
// Asia/Calcutta and Europe/Kiev, and none list UTC by that name.
const listed = (current: string, old: string) =>
  Intl.supportedValuesOf("timeZone").includes(current) ? current : old;

it.each([
  ["Kolkata", listed("Asia/Kolkata", "Asia/Calcutta")],
  ["Kyiv", listed("Europe/Kyiv", "Europe/Kiev")],
  ["UTC", "UTC"],
])("finds %s and writes the zone as listed", async (query, zone) => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<TimeZoneField value="America/Los_Angeles" onChange={onChange} />);
  await user.click(screen.getByRole("combobox", { name: "Time zone" }));
  await user.type(
    await screen.findByRole("combobox", { name: "Search" }),
    query,
  );
  await user.click(
    await screen.findByRole("option", {
      name: new RegExp(`^${zone.replaceAll("_", " ")}`),
    }),
  );
  expect(onChange).toHaveBeenCalledWith(zone);
});

it("keeps Chinese search and empty feedback inside a Chinese popup", async () => {
  localization.setLocale("zh-CN");
  const user = userEvent.setup();
  render(<TimeZoneField value="Asia/Shanghai" onChange={vi.fn()} />);
  await user.click(screen.getByRole("combobox", { name: "时区" }));
  const search = await screen.findByRole("combobox", { name: "搜索" });
  expect(search.closest("[lang]")).toHaveAttribute("lang", "zh-CN");
  await user.type(search, "no-such-zone");
  expect(screen.getByText("没有匹配的时区。")).toBeVisible();
});
