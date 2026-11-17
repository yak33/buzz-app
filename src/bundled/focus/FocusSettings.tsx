import { useLingui } from "@lingui/react/macro";
import { useSyncExternalStore } from "react";
import { Header } from "../../shared/design-system/ui/Header";
import { PreferenceRow } from "../../shared/design-system/ui/PreferenceRow";
import { Select } from "../../shared/design-system/ui/Select";
import { SettingsGroup } from "../../shared/design-system/ui/SettingsGroup";
import {
  type FocusLength,
  type FocusPreferences,
  focusLengths,
  type Preferences,
} from "./preferences";

function Choice<T extends string>({
  title,
  subtitle,
  value,
  options,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange(value: T): void;
}) {
  return (
    <PreferenceRow
      title={title}
      subtitle={subtitle}
      trailing={
        <Select
          label={title}
          variant="compact"
          value={value}
          groups={[
            {
              label: "",
              options: options.map(([value, label]) => ({ value, label })),
            },
          ]}
          onValueChange={(next) => onChange(next as T)}
        />
      }
    />
  );
}

/** Focus's defaults in Settings → Plugins. */
export function FocusSettings({
  preferences,
  active,
}: {
  preferences: Preferences;
  active(): boolean;
}) {
  const { i18n, t } = useLingui();
  const current = useSyncExternalStore(
    preferences.subscribe,
    preferences.snapshot,
  );
  const error = useSyncExternalStore(preferences.subscribe, preferences.error);
  const set = (change: Partial<FocusPreferences>) => {
    if (active()) preferences.set(change);
  };
  // The presets resolve to strings once so the shared `Choice` stays as is.
  const lengthOptions = focusLengths.map(
    ([value, label]) => [value, i18n._(label)] as const,
  );
  return (
    <section aria-label={t`Focus settings`}>
      <Header title={t`Focus`} />
      <SettingsGroup>
        <Choice<FocusLength>
          title={t`Default length`}
          subtitle={t`Used by the Focus shortcut, ⌥F by default, and selected when you open Focus from the profile menu.`}
          value={current.length}
          options={lengthOptions}
          onChange={(length) => set({ length })}
        />
      </SettingsGroup>
      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
