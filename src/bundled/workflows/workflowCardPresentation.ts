import { msg } from "@lingui/core/macro";
import { parse as parseYaml } from "yaml";
import { i18n } from "../../features/localization/service";

export type WorkflowCardIcon =
  | "delay"
  | "diff"
  | "message"
  | "reaction"
  | "schedule"
  | "webhook"
  | "workflow";

export type WorkflowCardPresentation = Readonly<{
  actionIcons: readonly Readonly<{
    icon: WorkflowCardIcon;
    key: string;
  }>[];
  description: string;
  triggerEmoji: string | null;
  triggerIcon: WorkflowCardIcon;
}>;

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function triggerPresentation(trigger: UnknownRecord | null): {
  icon: WorkflowCardIcon;
  label: string;
  emoji: string | null;
} {
  const type = typeof trigger?.on === "string" ? trigger.on : "";
  switch (type) {
    case "message_posted":
      return {
        icon: "message",
        label: i18n._(msg`When a message is posted`),
        emoji: null,
      };
    case "reaction_added":
      return {
        icon: "reaction",
        label: i18n._(msg`When a reaction is added`),
        emoji: typeof trigger?.emoji === "string" ? trigger.emoji : null,
      };
    case "diff_posted":
      return {
        icon: "diff",
        label: i18n._(msg`When a diff is posted`),
        emoji: null,
      };
    case "schedule":
      return { icon: "schedule", label: i18n._(msg`On a schedule`), emoji: null };
    case "webhook":
      return {
        icon: "webhook",
        label: i18n._(msg`When a webhook is received`),
        emoji: null,
      };
    default:
      return {
        icon: "workflow",
        label: i18n._(msg`When its trigger matches`),
        emoji: null,
      };
  }
}

function actionPresentation(action: unknown): {
  icon: WorkflowCardIcon;
  label: string;
} {
  switch (action) {
    case "send_message":
    case "send_dm":
      return { icon: "message", label: i18n._(msg`send a message`) };
    case "delay":
      return { icon: "delay", label: i18n._(msg`wait`) };
    case "add_reaction":
      return { icon: "reaction", label: i18n._(msg`add a reaction`) };
    case "call_webhook":
      return { icon: "webhook", label: i18n._(msg`call a webhook`) };
    default:
      return { icon: "workflow", label: i18n._(msg`run an action`) };
  }
}

function joinActions(labels: readonly string[]): string {
  const first = labels[0];
  const second = labels[1];
  if (!first) return i18n._(msg`run no actions`);
  if (!second) return first;
  if (labels.length === 2) return i18n._(msg`${first} and ${second}`);
  const head = labels.slice(0, -1).join(", ");
  const last = labels.at(-1) ?? second;
  return i18n._(msg`${head}, and ${last}`);
}

export function workflowCardPresentation(
  yaml: string,
): WorkflowCardPresentation {
  try {
    const document = record(parseYaml(yaml));
    const trigger = triggerPresentation(record(document?.trigger));
    const actions = Array.isArray(document?.steps)
      ? document.steps.map((step, index) => {
          const fields = record(step);
          return {
            ...actionPresentation(fields?.action),
            key:
              typeof fields?.id === "string"
                ? fields.id
                : `unidentified-${index}`,
          };
        })
      : [];
    const joined = joinActions(actions.map((action) => action.label));
    return {
      actionIcons: actions.map((action) => ({
        icon: action.icon,
        key: action.key,
      })),
      description: i18n._(msg`${trigger.label}, ${joined}.`),
      triggerEmoji: trigger.emoji,
      triggerIcon: trigger.icon,
    };
  } catch {
    return {
      actionIcons: [],
      description: i18n._(msg`Review this workflow configuration.`),
      triggerEmoji: null,
      triggerIcon: "workflow",
    };
  }
}
