import { Context } from "@deepseek-ai/cordis";
import { msg } from "@lingui/core/macro";
import { expect, it } from "vitest";
import { AgentsService } from "../../features/agents/service";
import {
  fakeCommunities,
  fakeRelay,
  fakeNative,
} from "../../features/agents/service-testing";
import { memoryStorage } from "../../features/agents/test-fakes";
import { addedKey, sessionTools } from "../../buzz-mcp/session-tools";
import { apply, inject } from ".";
import { provideNavigation } from "../../features/navigation/service";
import { PanelsService } from "../../features/panels/service";
import { PagesService } from "../../features/pages/service";

it("registers only the reader page and leaves built-in agent tools unchanged", async () => {
  const ctx = new Context();
  ctx.provide("pluginStatus", {
    isActive: () => true,
    subscribe: () => () => {},
  });
  const service = new AgentsService(
    ctx,
    fakeCommunities(fakeRelay()).communities,
    fakeNative(),
    memoryStorage(),
  );
  const pages = new PagesService(ctx);
  new PanelsService(ctx);
  provideNavigation(ctx, undefined);
  ctx.provide("relay", fakeRelay());
  ctx.provide("conversation", {
    codeBlocks: { snapshot: () => [], subscribe: () => () => {} },
  });
  let scope: ReturnType<Context["plugin"]> | undefined;
  try {
    const before = addedKey(service.tools());
    const builtins = sessionTools(service.tools()).map((tool) => tool.name);
    expect(builtins).toEqual(
      expect.arrayContaining(["notes_get", "notes_set", "notes_rm"]),
    );
    expect(
      sessionTools(service.tools()).some((tool) => tool.name === "note"),
    ).toBe(false);
    scope = ctx
      .extend({ pluginOwner: { id: "buzz.relay-notes", revision: "bundled" } })
      .plugin({ inject, apply });
    await scope;
    expect(service.tools()).toEqual([]);
    // 页面标题现在是 Lingui 描述符，渲染期由宿主翻译；断言比较描述符本身。
    expect(pages.snapshot()).toMatchObject([
      {
        id: "notes",
        title: msg`Shared notes`,
        layout: "workspace",
        primary: true,
        placement: "dock",
      },
    ]);
    expect(addedKey(service.tools())).toBe(before);
    expect(sessionTools(service.tools()).map((tool) => tool.name)).toEqual(
      builtins,
    );
    expect(
      sessionTools(service.tools()).some((tool) => tool.name === "note"),
    ).toBe(false);
    await scope.dispose();
    expect(service.tools()).toEqual([]);
    expect(pages.snapshot()).toEqual([]);
    expect(addedKey(service.tools())).toBe(before);
    expect(sessionTools(service.tools()).map((tool) => tool.name)).toEqual(
      builtins,
    );
  } finally {
    await scope?.dispose();
    await ctx.fiber.dispose();
  }
});
