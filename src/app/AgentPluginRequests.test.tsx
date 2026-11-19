// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { PluginManager } from "../plugins/manager";
import { i18n } from "../features/localization/service";
import { createPluginRequests } from "../plugins/requests";
import type {
  Catalog,
  ImportPreview,
  ManagedPlugins,
  PluginInfo,
} from "../plugins/types";
import { AgentPluginRequests } from "./AgentPluginRequests";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  if (i18n.locale !== "en-US") act(() => i18n.activate("en-US"));
});

const commit = "0123456789abcdef0123456789abcdef01234567";
const AGENT = { pubkey: "a".repeat(64), name: "Builder" };
const manifest = {
  id: "example.tasks",
  name: "Tasks",
  apiVersion: 1 as const,
  host: { networkOrigins: ["https://tasks.example.com"] },
};
const preview = (): ImportPreview => ({
  token: "preview",
  source: "https://example.com/plugins",
  commit,
  warnings: [],
  candidates: [{ path: "tasks", revision: "new", manifest }],
});
const catalog = (plugins: PluginInfo[] = []): Catalog => ({
  profile: "test",
  location: "test",
  plugins,
});

async function harness(plugins: PluginInfo[] = []) {
  const policy: { current: ManagedPlugins | undefined } = {
    current: undefined,
  };
  const imports = {
    git: vi.fn(async () => preview()),
    checkGit: vi.fn(async () => preview()),
    discard: vi.fn(async () => {}),
  };
  const manager = {
    imports,
    installImport: vi.fn(async () => true),
    change: vi.fn(async () => true),
    snapshot: (): { error: string | null } => ({ error: null }),
    requests: createPluginRequests({
      catalog: () => catalog(plugins),
      imports: imports as never,
      change: vi.fn(),
      error: () => null,
      managed: () => policy.current,
    }),
  };
  const agent = manager.requests.forAgent(AGENT);
  const release = vi.fn();
  const holdReview = vi.fn(() => release);
  const pluginsSection = document.body.appendChild(
    document.createElement("section"),
  );
  pluginsSection.tabIndex = -1;
  render(
    <AgentPluginRequests
      plugins={manager as unknown as PluginManager}
      catalog={catalog(plugins)}
      busy={false}
      holdReview={holdReview}
      fallbackFocus={() => pluginsSection}
    />,
  );
  return {
    manager,
    imports,
    agent,
    holdReview,
    release,
    policy,
    pluginsSection,
  };
}

it("shows nothing until an agent asks", async () => {
  await harness();
  expect(screen.queryByRole("region")).toBeNull();
});

it("installs the pinned commit only after the owner confirms, then tells the agent", async () => {
  const { manager, imports, agent } = await harness();
  const { requestId } = await agent.request({
    action: "install",
    repository: "https://example.com/plugins",
    reference: "main",
    reason: "Tracks the sprint board",
  });
  const group = await screen.findByRole("region", {
    name: "Requested by agents",
  });
  expect(group).toHaveTextContent("Install Tasks");
  expect(
    within(group).getByText("Builder: Tracks the sprint board"),
  ).toBeVisible();
  expect(imports.git).not.toHaveBeenCalled();
  fireEvent.click(within(group).getByRole("button", { name: /Review/ }));
  const dialog = await screen.findByRole("dialog", {
    name: "Review Tasks Plugin access",
  });
  await within(dialog).findByText(`Commit: ${commit}`);
  expect(imports.git).toHaveBeenCalledExactlyOnceWith(
    "https://example.com/plugins",
    "main",
    undefined,
    { commit, path: "tasks" },
  );
  expect(dialog).toHaveAccessibleDescription(
    "Requested by Builder. Only install code you trust.",
  );
  expect(within(dialog).getByText("Tracks the sprint board")).toBeVisible();
  expect(within(dialog).getByText(/tasks\.example\.com/)).toBeVisible();
  expect(agent.status(requestId).state).toBe("pending");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Install plugin" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(manager.installImport).toHaveBeenCalledExactlyOnceWith(
    "preview",
    "tasks",
  );
  expect(manager.change).toHaveBeenCalledWith("enable", "example.tasks");
  expect(agent.status(requestId).state).toBe("approved");
  expect(screen.queryByRole("region")).toBeNull();
});

it("translates request actions without translating the agent-provided reason", async () => {
  const { agent } = await harness();
  await agent.request({
    action: "install",
    repository: "https://example.com/plugins",
    reference: "main",
    reason: "Tracks the sprint board",
  });
  await screen.findByRole("region", { name: "Requested by agents" });

  act(() => i18n.activate("zh-CN"));

  const chineseGroup = screen.getByRole("region", { name: "智能体的请求" });
  const action = within(chineseGroup).getByText("安装");
  expect(action).toHaveAttribute("lang", "zh-CN");
  expect(action).toHaveTextContent("安装 Tasks");
  expect(within(action).getByText("Tasks")).toHaveAttribute("lang", "");
  expect(
    within(chineseGroup).getByRole("button", { name: "检查 Tasks" }),
  ).toBeVisible();
  expect(
    within(chineseGroup).getByRole("button", { name: "拒绝 Tasks" }),
  ).toBeVisible();
  const requestReason = within(chineseGroup).getByText(
    "Builder: Tracks the sprint board",
  );
  expect(requestReason).toBeVisible();
  expect(requestReason).toHaveAttribute("lang", "");
});

it("localizes an install review while preserving plugin and requester language", async () => {
  const { agent } = await harness();
  await agent.request({
    action: "install",
    repository: "https://example.com/plugins",
    reference: "main",
    reason: "Tracks the sprint board",
  });
  await screen.findByRole("region", { name: "Requested by agents" });
  act(() => i18n.activate("zh-CN"));
  fireEvent.click(await screen.findByRole("button", { name: "检查 Tasks" }));

  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByText(`Commit: ${commit}`);
  expect(dialog).toHaveAttribute("lang", "zh-CN");
  const heading = within(dialog).getByRole("heading", { level: 2 });
  expect(heading).toHaveTextContent("Tasks");
  expect(within(heading).getByText("Tasks")).toHaveAttribute("lang", "");
  expect(dialog).toHaveAccessibleDescription(
    "由 Builder 请求。请仅安装你信任的代码。",
  );
  expect(
    within(dialog).getByText("Builder", { selector: 'span[lang=""]' }),
  ).toBeVisible();
  expect(
    within(dialog).getByText("Tracks the sprint board", {
      selector: 'span[lang=""]',
    }),
  ).toBeVisible();
});

it("leaves the request pending when the review is closed, and declines it on request", async () => {
  const { manager, agent } = await harness();
  const { requestId } = await agent.request({
    action: "install",
    repository: "https://example.com/plugins",
    reason: "Tracks the sprint board",
  });
  fireEvent.click(await screen.findByRole("button", { name: "Review Tasks" }));
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByText(`Commit: ${commit}`);
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(agent.status(requestId).state).toBe("pending");
  fireEvent.click(screen.getByRole("button", { name: "Decline Tasks" }));
  await waitFor(() => expect(screen.queryByRole("region")).toBeNull());
  expect(agent.status(requestId).state).toBe("declined");
  expect(manager.installImport).not.toHaveBeenCalled();
});

const installed = (extra: Partial<PluginInfo> = {}): PluginInfo => ({
  manifest,
  source: "external",
  enabled: false,
  revision: "old",
  previous: null,
  reloadable: false,
  error: null,
  updateSource: {
    repository: "https://example.com/plugins",
    reference: "main",
    path: "tasks",
  },
  ...extra,
});

it.each([
  ["enable", "dialog", "启用“Tasks”？", "启用插件"],
  ["remove", "alertdialog", "删除“Tasks”？", "删除插件"],
] as const)(
  "translates the %s confirmation while preserving its reason",
  async (action, role, title, confirmLabel) => {
    const { agent } = await harness([
      installed({ enabled: action === "remove" }),
    ]);
    await agent.request({ action, id: "example.tasks", reason });

    act(() => i18n.activate("zh-CN"));
    fireEvent.click(await screen.findByRole("button", { name: "检查 Tasks" }));

    const dialog = await screen.findByRole(role, { name: title });
    expect(dialog).toHaveAttribute("lang", "zh-CN");
    const heading = within(dialog).getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent(title);
    expect(within(heading).getByText("Tasks")).toHaveAttribute("lang", "");
    expect(
      within(dialog).getByRole("button", { name: confirmLabel }),
    ).toBeVisible();
    expect(within(dialog).getByText(reason, { selector: "p" })).toHaveAttribute(
      "lang",
      "",
    );
  },
);

const reason = "Tracks the sprint board";

it("updates at the pinned commit and keeps the plugin's enabled state", async () => {
  const { manager, imports, agent } = await harness([installed()]);
  const { requestId } = await agent.request({
    action: "update",
    id: "example.tasks",
    reason,
  });
  const group = await screen.findByRole("region", {
    name: "Requested by agents",
  });
  expect(group).toHaveTextContent("Update Tasks");
  fireEvent.click(await screen.findByRole("button", { name: "Review Tasks" }));
  const dialog = await screen.findByRole("dialog", { name: "Update Tasks" });
  await within(dialog).findByText(`Commit: ${commit}`);
  expect(imports.git).toHaveBeenCalledWith(
    "https://example.com/plugins",
    "main",
    undefined,
    { commit, path: "tasks" },
  );
  expect(
    within(dialog).getByText(reason, { selector: 'span[lang=""]' })
      .parentElement,
  ).toHaveTextContent(`Builder: ${reason}`);
  fireEvent.click(within(dialog).getByRole("button", { name: "Update" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(manager.installImport).toHaveBeenCalledWith("preview", "tasks");
  expect(manager.change).not.toHaveBeenCalled();
  expect(agent.status(requestId).state).toBe("approved");
});

it("shows a plugin's access before enabling it", async () => {
  const { manager, agent } = await harness([installed()]);
  const { requestId } = await agent.request({
    action: "enable",
    id: "example.tasks",
    reason,
  });
  expect(
    screen.getByRole("region", { name: "Requested by agents" }),
  ).toHaveTextContent("Enable Tasks");
  fireEvent.click(screen.getByRole("button", { name: /Review/ }));
  const dialog = await screen.findByRole("dialog", { name: "Enable Tasks?" });
  expect(dialog).toHaveAccessibleDescription(
    "Requested by Builder. Only enable code you trust.",
  );
  expect(within(dialog).getByText(reason)).toBeVisible();
  expect(within(dialog).getByText(/tasks\.example\.com/)).toBeVisible();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Enable plugin" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(manager.change).toHaveBeenCalledExactlyOnceWith(
    "enable",
    "example.tasks",
  );
  expect(agent.status(requestId).state).toBe("approved");
});

it("deletes only after confirmation and keeps the request when storage refuses", async () => {
  const { manager, agent } = await harness([installed({ enabled: true })]);
  const { requestId } = await agent.request({
    action: "remove",
    id: "example.tasks",
    reason,
  });
  manager.change.mockResolvedValueOnce(false);
  manager.snapshot = () => ({ error: "Plugin storage is busy" });
  fireEvent.click(await screen.findByRole("button", { name: "Review Tasks" }));
  const dialog = await screen.findByRole("alertdialog", {
    name: "Delete Tasks?",
  });
  expect(within(dialog).getByText(reason)).toBeVisible();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Delete plugin" }),
  );
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "Plugin storage is busy",
  );
  expect(agent.status(requestId).state).toBe("pending");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Delete plugin" }),
  );
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(manager.change).toHaveBeenLastCalledWith("remove", "example.tasks");
  expect(agent.status(requestId).state).toBe("approved");
});

it.each([
  ["install", []],
  ["enable", [installed()]],
] as const)(
  "holds plugin install requests while a %s review is open",
  async (action, plugins) => {
    const { agent, holdReview, release } = await harness([...plugins]);
    await agent.request(
      action === "install"
        ? {
            action,
            repository: "https://example.com/plugins",
            reason,
          }
        : { action, id: "example.tasks", reason },
    );
    expect(holdReview).not.toHaveBeenCalled();
    fireEvent.click(
      await screen.findByRole("button", { name: "Review Tasks" }),
    );
    const dialog = await screen.findByRole("dialog");
    if (action === "install")
      await within(dialog).findByText(`Commit: ${commit}`);
    await waitFor(() => expect(holdReview).toHaveBeenCalledOnce());
    expect(release).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(release).toHaveBeenCalledOnce());
  },
);

it.each([
  ["install", []],
  ["update", [installed()]],
] as const)(
  "refuses a queued %s request once the organization recommends the plugin",
  async (action, plugins) => {
    const { manager, agent, policy } = await harness([...plugins]);
    const { requestId } = await agent.request(
      action === "install"
        ? { action, repository: "https://example.com/plugins", reason }
        : { action, id: "example.tasks", reason },
    );
    policy.current = {
      status: "ready",
      path: "/data/managed-plugins.json",
      source: "Example Org",
      problems: [],
      plugins: [
        {
          id: "example.tasks",
          repository: "https://example.com/plugins",
          reference: "main",
          commit: "f".repeat(40),
          path: "tasks",
          state: action === "install" ? "missing" : "outdated",
        },
      ],
    };
    fireEvent.click(
      await screen.findByRole("button", { name: "Review Tasks" }),
    );
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(`Commit: ${commit}`);
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: action === "install" ? "Install plugin" : "Update",
      }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "example.tasks follows Example Org's recommendation; install or update it from the recommendation in Settings",
    );
    expect(manager.installImport).not.toHaveBeenCalled();
    expect(agent.status(requestId).state).toBe("pending");
  },
);

const notes = installed({
  manifest: { ...manifest, id: "example.notes", name: "Notes" },
});
const enable = (
  agent: Awaited<ReturnType<typeof harness>>["agent"],
  id: string,
) => agent.request({ action: "enable", id, reason });

it("moves keyboard focus to the Manage plugins section when the last request is declined", async () => {
  const { agent, pluginsSection } = await harness([installed()]);
  await enable(agent, "example.tasks");
  const decline = await screen.findByRole("button", { name: "Decline Tasks" });
  decline.focus();
  fireEvent.click(decline);
  await waitFor(() => expect(screen.queryByRole("region")).toBeNull());
  expect(pluginsSection).toHaveFocus();
});

it("keeps keyboard focus on the remaining requests when one is declined", async () => {
  const { agent } = await harness([installed(), notes]);
  await enable(agent, "example.tasks");
  await enable(agent, "example.notes");
  const decline = await screen.findByRole("button", { name: "Decline Tasks" });
  decline.focus();
  fireEvent.click(decline);
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Decline Tasks" })).toBeNull(),
  );
  expect(
    screen.getByRole("region", { name: "Requested by agents" }),
  ).toHaveFocus();
});

it.each([
  ["no request remains", [installed()], undefined],
  ["another request remains", [installed(), notes], "region"],
] as const)(
  "returns focus to a surviving target when approving leaves %s",
  async (_label, plugins, survivor) => {
    const { agent, pluginsSection } = await harness([...plugins]);
    await enable(agent, "example.tasks");
    if (survivor) await enable(agent, "example.notes");
    const review = await screen.findByRole("button", { name: "Review Tasks" });
    review.focus();
    fireEvent.click(review);
    const dialog = await screen.findByRole("dialog", { name: "Enable Tasks?" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Enable plugin" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() =>
      expect(
        survivor
          ? screen.getByRole("region", { name: "Requested by agents" })
          : pluginsSection,
      ).toHaveFocus(),
    );
  },
);
