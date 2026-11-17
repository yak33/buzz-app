import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import type { AgentViewProps } from "../../features/agents/service";
import { Button } from "../../shared/design-system/ui/Button";
import { Field } from "../../shared/design-system/ui/Field";
import { Input } from "../../shared/design-system/ui/Input";
import { Select } from "../../shared/design-system/ui/Select";
import { Textarea } from "../../shared/design-system/ui/Textarea";
import {
  DEFAULT_WORKSPACE,
  type MeshAgentConfig,
  type MeshMode,
  meshAgentConfig,
  validWorkspace,
} from "./meshAgent";
import { MESH_AGENT_PRESETS } from "./meshAgentPresets";

// Option labels are descriptors (preset names stay as stored data strings).
const options = (
  choices: readonly (readonly [string, MessageDescriptor | string])[],
) => [
  { label: "", options: choices.map(([value, label]) => ({ value, label })) },
];
const MODES = options([
  ["chat", msg`Chat`],
  ["agent", msg`Agent`],
]);
const MODE_DESCRIPTIONS: Record<MeshMode, MessageDescriptor> = {
  chat: msg`Answers from the conversation alone, with no tools. Suits small models.`,
  agent: msg`Works with shell, project skills and Buzz tools.`,
};
const SCOPES = options([
  ["thread", msg`One session per thread`],
  ["channel", msg`One session per channel`],
]);
const CUSTOM = "custom";
const PRESETS = options([
  [CUSTOM, msg`Custom`],
  ...MESH_AGENT_PRESETS.map((preset) => [preset.id, preset.name] as const),
]);

/** The Mesh type's settings: a starting preset, prompt, mode, sessions and
 * working directory. */
export function MeshAgentTab({ agent, save }: AgentViewProps<MeshAgentConfig>) {
  const { i18n, t } = useLingui();
  // Select groups want translated strings; the tables above hold descriptors
  // (preset names pass through as stored data).
  const localize = (
    groups: readonly {
      label: string;
      options: readonly { value: string; label: MessageDescriptor | string }[];
    }[],
  ) =>
    groups.map((group) => ({
      label: group.label,
      options: group.options.map((option) => ({
        value: option.value,
        label:
          typeof option.label === "string"
            ? option.label
            : i18n._(option.label),
      })),
    }));
  const saved = meshAgentConfig(agent.config);
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const workspaceValid = validWorkspace(draft.workspace);
  const changed =
    draft.prompt !== saved.prompt ||
    draft.workspace.trim() !== saved.workspace ||
    draft.mode !== saved.mode ||
    draft.scope !== saved.scope ||
    draft.preset !== saved.preset;
  const preset = MESH_AGENT_PRESETS.find((item) => item.id === draft.preset);
  const submit = async () => {
    if (!changed || saving || !workspaceValid) return;
    setSaving(true);
    setError(undefined);
    try {
      await save({ ...draft, workspace: draft.workspace.trim() });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Select
        label={t`Start from`}
        variant="field"
        value={draft.preset ?? CUSTOM}
        groups={localize(PRESETS)}
        description={
          preset?.summary ??
          t`Pick an example to fill the prompt and mode, then edit as you like.`
        }
        onValueChange={(value) => {
          const picked = MESH_AGENT_PRESETS.find((item) => item.id === value);
          if (!picked) {
            const { preset: _, ...rest } = draft;
            setDraft(rest);
            return;
          }
          setDraft({
            ...draft,
            preset: picked.id,
            prompt: picked.prompt,
            mode: picked.mode,
          });
        }}
      />
      <Field
        label={t`Prompt`}
        description={t`The system prompt for every reply. Replies come from this community's shared compute.`}
      >
        <Textarea
          rows={8}
          value={draft.prompt}
          onChange={(event) =>
            setDraft({ ...draft, prompt: event.target.value })
          }
        />
      </Field>
      <Select
        label={t`Mode`}
        variant="field"
        value={draft.mode}
        groups={localize(MODES)}
        description={i18n._(MODE_DESCRIPTIONS[draft.mode])}
        onValueChange={(value) =>
          setDraft({
            ...draft,
            mode: value === "chat" ? "chat" : "agent",
          })
        }
      />
      <Select
        label={t`Sessions`}
        variant="field"
        value={draft.scope}
        groups={localize(SCOPES)}
        onValueChange={(value) =>
          setDraft({
            ...draft,
            scope: value === "channel" ? "channel" : "thread",
          })
        }
      />
      {draft.mode !== "chat" && (
        <Field
          label={t`Workspace`}
          description={t`Where its shell runs, and where it finds project skills. An absolute path, or ${DEFAULT_WORKSPACE}.`}
          error={workspaceValid ? undefined : t`Use an absolute path.`}
        >
          <Input
            value={draft.workspace}
            onChange={(event) =>
              setDraft({ ...draft, workspace: event.target.value })
            }
          />
        </Field>
      )}
      {error && (
        <p role="alert" className="buzz-field-error">
          {error}
        </p>
      )}
      <div>
        <Button
          type="submit"
          variant="prominent"
          loading={saving}
          disabled={!changed || !workspaceValid}
          focusableWhenDisabled
        >
          {t`Save`}
        </Button>
      </div>
    </form>
  );
}
