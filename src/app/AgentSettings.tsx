import { useState } from "react";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import type { PageNavigation } from "../features/navigation/service";
import type { Agents } from "../features/agents/service";
import { AgentDefaults } from "../bundled/agents/AgentDefaults";
import { Header, InlineHeader } from "../shared/design-system/ui/Header";

import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { SwitchPreferenceRow } from "../shared/design-system/ui/SwitchPreferenceRow";
import { ToastNotice } from "../shared/design-system/ui/Toast";
import { Button } from "../shared/design-system/ui/Button";
import {
  setRememberAgentsPreference,
  useRememberAgentsPreference,
} from "../features/messages/mention-preferences";
import { isTauri } from "@tauri-apps/api/core";
import { isApplePlatform } from "../features/shortcuts/format";
import { PreferenceRow } from "../shared/design-system/ui/PreferenceRow";
import { Select } from "../shared/design-system/ui/Select";
import {
  keepAwakeDelays,
  retryKeepAwake,
  setKeepAwakePreference,
  useKeepAwakeApplyError,
  useKeepAwakePreference,
  type KeepAwake,
} from "../features/agents/keep-awake";

const keepAwakeModes: readonly {
  value: "off" | "auto" | "on";
  label: MessageDescriptor;
}[] = [
  { value: "off", label: msg`Off` },
  { value: "auto", label: msg`While agents work` },
  { value: "on", label: msg`Always` },
];

export function AgentSettings({
  agents,
  active = true,
  navigation,
  onProvider,
  keepAwakeAvailable = isTauri() && isApplePlatform(navigator.platform),
}: {
  agents?: Agents | undefined;
  active?: boolean;
  navigation?: PageNavigation | undefined;
  onProvider?: ((provider?: string) => void) | undefined;
  /** Only the macOS app can keep the computer awake. */
  keepAwakeAvailable?: boolean;
}) {
  const { i18n, t } = useLingui();
  // Plural forms split into complete templates per the localization rules.
  const delayLabel = (minutes: number) =>
    minutes < 60
      ? t`${minutes} minutes`
      : minutes === 60
        ? t`1 hour`
        : t`${minutes / 60} hours`;
  const rememberAgents = useRememberAgentsPreference();
  const keepAwake = useKeepAwakePreference();
  const keepAwakeApplyError = useKeepAwakeApplyError();
  const [mentionError, setMentionError] = useState<string | null>(null);
  const [keepAwakeError, setKeepAwakeError] = useState<string | null>(null);
  const changeRememberAgents = (enabled: boolean) =>
    setMentionError(setRememberAgentsPreference(enabled));
  const changeKeepAwake = (change: Partial<KeepAwake>) =>
    setKeepAwakeError(setKeepAwakePreference({ ...keepAwake, ...change }));
  return (
    <section aria-labelledby="agent-settings-title">
      <Header id="agent-settings-title" title={t`Agent setup`} />
      {agents && active && (
        <AgentDefaults
          agents={agents}
          navigation={navigation}
          onProvider={onProvider}
        />
      )}
      <div className="mt-section-gap">
        <InlineHeader title={t`Agent behavior`} />
        <SettingsGroup>
          <SwitchPreferenceRow
            label={t`Remember mentioned agents`}
            description={t`Keep the same agents selected for your next message in this channel or thread.`}
            checked={rememberAgents}
            onCheckedChange={changeRememberAgents}
          />
          {keepAwakeAvailable && (
            <PreferenceRow
              title={t`Keep this Mac awake`}
              subtitle={t`So agents can keep answering. Closing the lid still puts it to sleep.`}
              trailing={
                <Select
                  label={t`Keep this Mac awake`}
                  variant="compact"
                  value={keepAwake.mode}
                  groups={[
                    {
                      label: "",
                      options: keepAwakeModes.map(({ value, label }) => ({
                        value,
                        label: i18n._(label),
                      })),
                    },
                  ]}
                  onValueChange={(mode) =>
                    changeKeepAwake({ mode: mode as KeepAwake["mode"] })
                  }
                />
              }
            />
          )}
          {keepAwakeAvailable && keepAwake.mode === "auto" && (
            <PreferenceRow
              title={t`Stay awake after agents finish`}
              trailing={
                <Select
                  label={t`Stay awake after agents finish`}
                  variant="compact"
                  value={String(keepAwake.after)}
                  groups={[
                    {
                      label: "",
                      options: keepAwakeDelays.map((minutes) => ({
                        value: String(minutes),
                        label: delayLabel(minutes),
                      })),
                    },
                  ]}
                  onValueChange={(after) =>
                    changeKeepAwake({ after: Number(after) })
                  }
                />
              }
            />
          )}
        </SettingsGroup>
      </div>
      {active && mentionError && (
        <ToastNotice
          title={t`Agent preference wasn’t saved`}
          description={mentionError}
        >
          <Button
            type="button"
            size="sm"
            onClick={() => changeRememberAgents(rememberAgents)}
          >
            {t`Retry saving mentioned agents`}
          </Button>
        </ToastNotice>
      )}
      {/* One notice at a time; whether the Mac sleeps matters more than
          whether the choice outlives a restart. */}
      {active &&
        (keepAwakeAvailable && keepAwakeApplyError ? (
          <ToastNotice title={keepAwakeApplyError}>
            <Button type="button" size="sm" onClick={retryKeepAwake}>
              {t`Try again`}
            </Button>
          </ToastNotice>
        ) : (
          keepAwakeError && (
            <ToastNotice
              title={t`Keep-awake setting wasn’t saved`}
              description={keepAwakeError}
            >
              <Button
                type="button"
                size="sm"
                onClick={() => changeKeepAwake(keepAwake)}
              >
                {t`Try again`}
              </Button>
            </ToastNotice>
          )
        ))}
    </section>
  );
}
