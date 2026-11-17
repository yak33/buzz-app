import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import {
  CHANNEL_DURATIONS,
  channelDurationLabel,
} from "../../bundled/channels/ChannelDurationField";
import { Select } from "../../shared/design-system/ui/Select";
import { SettingsGroup } from "../../shared/design-system/ui/SettingsGroup";
import { useDefaultLifetime, writeDefaultLifetime } from "./default-lifetime";

/** The lifetime New chat starts Solo chats with, saved as soon as it
 * changes. The same choices as a chat's own lifetime setting. */
export function DefaultLifetimeSettings({ scope }: { scope: string }) {
  const { t, i18n } = useLingui();
  const ttlSeconds = useDefaultLifetime(scope);
  const [saveFailed, setSaveFailed] = useState(false);
  return (
    <div lang={i18n.locale}>
      <SettingsGroup>
        <Select
          lang={i18n.locale}
          variant="preference"
          label={t`New Solo chats`}
          description={t`Chats you start with New chat in this community begin with this lifetime. You can change it in a chat’s settings.`}
          value={ttlSeconds === undefined ? "ongoing" : String(ttlSeconds)}
          valueLabel={
            ttlSeconds === undefined
              ? t`Ongoing`
              : t`Temporary, ${channelDurationLabel(ttlSeconds, i18n.locale)}`
          }
          error={
            saveFailed
              ? t`Couldn’t save this on this device. Try again.`
              : undefined
          }
          groups={[
            {
              label: "",
              options: [
                {
                  value: "ongoing",
                  label: t`Ongoing`,
                  description: t`No automatic archive.`,
                },
                ...CHANNEL_DURATIONS.map((seconds) => ({
                  value: String(seconds),
                  label: t`Temporary, ${channelDurationLabel(seconds, i18n.locale)}`,
                  description: t`Archives after ${channelDurationLabel(seconds, i18n.locale)} without activity.`,
                })),
              ],
            },
          ]}
          onValueChange={(value) => {
            const saved = writeDefaultLifetime(
              scope,
              value === "ongoing" ? undefined : Number(value),
            );
            setSaveFailed(!saved);
          }}
        />
      </SettingsGroup>
    </div>
  );
}
