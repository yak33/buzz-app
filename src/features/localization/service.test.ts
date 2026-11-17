// @vitest-environment jsdom
import { msg } from "@lingui/core/macro";
import { afterEach, expect, it, vi } from "vitest";
import { createLocalization as create, LANGUAGE_KEY } from "./service";

const instances: ReturnType<typeof create>[] = [];
const createLocalization: typeof create = (...args) => {
  const instance = create(...args);
  instances.push(instance);
  return instance;
};

afterEach(() => {
  for (const instance of instances.splice(0)) instance.dispose();
  vi.restoreAllMocks();
  localStorage.clear();
});

const host = (languages: readonly string[], storage: Storage = localStorage) =>
  ({
    navigator: { languages },
    localStorage: storage,
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
  }) as unknown as Window;

it("starts in the first supported system language", () => {
  const { i18n } = createLocalization(host(["fr-FR", "zh-CN"]));
  expect(i18n.locale).toBe("zh-CN");
  expect(i18n._(msg`Settings`)).toBe("设置");
});

it("starts in the saved language over the system language", () => {
  localStorage.setItem(LANGUAGE_KEY, "en-US");
  expect(createLocalization(host(["zh-CN"])).i18n.locale).toBe("en-US");
});

it("saves a choice and follows changes made in another window", () => {
  const localization = createLocalization(host(["en-US"]));
  expect(localization.setLocale("zh-CN")).toBe(true);
  expect(localStorage.getItem(LANGUAGE_KEY)).toBe("zh-CN");

  localStorage.setItem(LANGUAGE_KEY, "en-US");
  window.dispatchEvent(new StorageEvent("storage", { key: LANGUAGE_KEY }));
  expect(localization.i18n.locale).toBe("en-US");
});

it("keeps the document's language metadata while switching", () => {
  document.documentElement.lang = "en";
  createLocalization(host(["en-US"])).setLocale("zh-CN");
  expect(document.documentElement.lang).toBe("en");
});

it("applies an unsaved choice for this session when storage fails", () => {
  const failing = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
  } as unknown as Storage;
  const localization = createLocalization(host(["en-US"], failing));
  expect(localization.i18n.locale).toBe("en-US");
  expect(localization.setLocale("zh-CN")).toBe(false);
  expect(localization.i18n.locale).toBe("zh-CN");
});

it("notifies Lingui subscribers when the locale changes", () => {
  const { i18n, setLocale } = createLocalization(host(["en-US"]));
  const change = vi.fn();
  i18n.on("change", change);
  setLocale("zh-CN");
  expect(change).toHaveBeenCalledTimes(1);
  expect(i18n._(msg`Settings`)).toBe("设置");
});

it("rejects a locale that is not registered", () => {
  const localization = createLocalization(host(["en-US"]));
  expect(() => localization.setLocale("fr-FR")).toThrow("Unsupported locale");
  expect(localStorage.getItem(LANGUAGE_KEY)).toBeNull();
});

it("publishes unsaved status across subscribers until a successful retry", () => {
  const localization = createLocalization(host(["en-US"]));
  const listener = vi.fn();
  const unsubscribe = localization.subscribe(listener);
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("denied");
    });
  expect(localization.unsaved()).toBe(false);
  localization.setLocale("zh-CN");
  expect(localization.unsaved()).toBe(true);
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
  const reopened = vi.fn();
  localization.subscribe(reopened);
  localization.setLocale("zh-CN");
  expect(localization.unsaved()).toBe(true);
  expect(reopened).not.toHaveBeenCalled();

  write.mockRestore();
  expect(localization.setLocale("zh-CN")).toBe(true);
  expect(localization.unsaved()).toBe(false);
  expect(reopened).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledTimes(1);
});

it("clears unsaved status only after reconciling readable local storage", () => {
  const localization = createLocalization(host(["en-US"]));
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("denied");
    });
  localization.setLocale("zh-CN");
  write.mockRestore();
  localStorage.setItem(LANGUAGE_KEY, "en-US");

  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("denied");
  });
  window.dispatchEvent(new StorageEvent("storage", { key: LANGUAGE_KEY }));
  expect(localization.i18n.locale).toBe("zh-CN");
  expect(localization.unsaved()).toBe(true);
  read.mockRestore();

  window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: LANGUAGE_KEY,
      storageArea: sessionStorage,
    }),
  );
  expect(localization.i18n.locale).toBe("zh-CN");
  expect(localization.unsaved()).toBe(true);

  // The current stored choice wins over stale event data.
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: LANGUAGE_KEY,
      newValue: "zh-CN",
      storageArea: localStorage,
    }),
  );
  expect(localization.i18n.locale).toBe("en-US");
  expect(localization.unsaved()).toBe(false);
});
