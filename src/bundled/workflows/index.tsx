import { msg } from "@lingui/core/macro";
import { i18n } from "../../features/localization/service";
import type { PluginModule } from "../../plugins/api";
import { WorkflowsPage } from "./WorkflowsPage";
export const inject = ["pages", "relay"];
export const apply: PluginModule["apply"] = (ctx) => {
  const relay = ctx.relay;
  ctx.pages.register({
    id: "workflows",
    title: i18n._(msg`Workflows`),
    layout: "workspace",
    primary: true,
    component: () => <WorkflowsPage relay={relay} />,
  });
};
