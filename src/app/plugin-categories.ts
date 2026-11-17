import { msg } from "@lingui/core/macro";

export const pluginCategoryDefinitions = [
  { id: "communication", label: msg`Communication` },
  { id: "agents", label: msg`Agents` },
  { id: "agent-tools", label: msg`Agent tools` },
  {
    id: "developer-tools-and-integrations",
    label: msg`Developer tools & integrations`,
  },
  { id: "people-and-communities", label: msg`People & communities` },
  { id: "productivity", label: msg`Productivity` },
] as const;
