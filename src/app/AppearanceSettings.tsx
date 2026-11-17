import { useLingui } from "@lingui/react/macro";
import { Select } from "../shared/design-system/ui/Select";
import { ACCENTS, accentButtonStyle } from "../shared/theme/accent";

import { IconButton } from "../shared/design-system/ui/IconButton";
import {
  ArrowCounterClockwiseIcon,
  CircleIcon,
} from "../shared/design-system/icons";
import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { Header, InlineHeader } from "../shared/design-system/ui/Header";
import { ToastNotice } from "../shared/design-system/ui/Toast";
import { PreferenceRow } from "../shared/design-system/ui/PreferenceRow";
import { AppearancePreview } from "./AppearancePreview";
import { Button } from "../shared/design-system/ui/Button";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import type { Appearance } from "../shared/theme/service";

import {
  setThreadPlacementPreference,
  useThreadPlacementPreference,
} from "../features/messages/thread-preferences";

import {
  useFollowUpBehaviorPreference,
  setFollowUpBehaviorPreference,
} from "../features/messages/follow-up-preference";
import {
  setMessageAutocorrectPreference,
  useMessageAutocorrectPreference,
} from "../features/messages/autocorrect-preference";
import {
  setUnreadFirstPreference,
  useUnreadFirstPreference,
} from "../features/search/unread-first-preference";
import { macWebKit } from "../features/messages/mac-webkit";
import { SwitchPreferenceRow } from "../shared/design-system/ui/SwitchPreferenceRow";
import {
  setClockPreference,
  useClockPreference,
} from "../shared/clock-preference";
import {
  setNamePreference,
  useNamePreference,
} from "../features/profiles/name-preference";
import type { Communities } from "../features/communities/service";

const noRelay = () => () => {};
/** Whether the connected community verifies people's names, so there is a
 * username and a full name to choose between. */
function useVerifiedCommunity(relay: Communities["relay"] | undefined) {
  const connection = useSyncExternalStore(relay?.subscribe ?? noRelay, () =>
    relay?.snapshot(),
  );
  const profiles =
    connection?.status === "ready" ? connection.session.profiles : undefined;
  return useSyncExternalStore(
    profiles?.subscribe ?? noRelay,
    () => !!profiles?.verifiedAuthority?.(),
  );
}

export function AppearanceSettings({
  appearance,
  active = true,
  autocorrectAvailable = macWebKit(),
  communities,
}: {
  appearance: Appearance;
  active?: boolean;
  /** Only Mac WebKit applies the composer's autocorrect attribute. */
  autocorrectAvailable?: boolean;
  communities?: Pick<Communities, "relay"> | undefined;
}) {
  const { t, i18n } = useLingui();
  const accentLabels = {
    bee: t`Honey`,
    magenta: t`Magenta`,
    iris: t`Iris`,
    cobalt: t`Cobalt`,
    citrus: t`Citrus`,
    mono: t`Mono`,
  };
  const followUp = useFollowUpBehaviorPreference();
  const autocorrect = useMessageAutocorrectPreference();
  const unreadFirst = useUnreadFirstPreference();
  const clock = useClockPreference();
  const names = useNamePreference();
  const verifiedCommunity = useVerifiedCommunity(communities?.relay);
  const { placement, unsaved } = useThreadPlacementPreference();
  const increaseButton = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<HTMLButtonElement | null>(null);
  const resetRef = useCallback((node: HTMLButtonElement | null) => {
    if (!node) return;
    return () => {
      if (document.activeElement === node)
        pendingFocus.current = increaseButton.current;
    };
  }, []);
  useLayoutEffect(() => {
    // At 200%, Increase is still disabled during Reset's ref cleanup.
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target?.isConnected) target.focus();
  });
  const {
    preference,
    mode,
    error,
    messageWidth,
    messageWidthError,
    fontScale,
    fontError,
    accent,
    accentError,
    contrast,
    contrastError,
    density,
    densityError,
  } = useSyncExternalStore(appearance.subscribe, appearance.snapshot);
  return (
    <section lang={i18n.locale} aria-labelledby="appearance-settings-title">
      <Header id="appearance-settings-title" title={t`Appearance`} />
      <div>
        <InlineHeader title={t`Interface`} />
        <SettingsGroup>
          <PreferenceRow
            id="setting-mode"
            title={t`Mode`}
            trailing={
              <Select
                lang={i18n.locale}
                variant="compact"
                label={t`Mode`}
                value={preference}
                groups={[
                  {
                    label: t`Mode`,
                    options: [
                      { value: "system", label: t`System` },
                      { value: "light", label: t`Light` },
                      { value: "dark", label: t`Dark` },
                    ],
                  },
                ]}
                onValueChange={(value) => {
                  if (
                    value === "system" ||
                    value === "light" ||
                    value === "dark"
                  )
                    appearance.setMode(value);
                }}
              />
            }
          />
          <PreferenceRow
            title={t`Interface size`}
            trailing={
              <fieldset
                aria-label={t`Interface size`}
                className="m-0 flex min-w-0 flex-wrap items-center gap-3 border-0 p-0"
              >
                <Button
                  type="button"
                  size="sm"
                  aria-label={t`Decrease interface size`}
                  disabled={fontScale <= 0.8}
                  onClick={() => appearance.setFontScale(fontScale - 0.1)}
                >
                  −
                </Button>
                <output
                  aria-label={t`Interface size`}
                  className="text-body-sm tabular-nums"
                >
                  {Math.round(fontScale * 100)}%
                </output>
                <Button
                  type="button"
                  size="sm"
                  ref={increaseButton}
                  aria-label={t`Increase interface size`}
                  disabled={fontScale >= 2}
                  onClick={() => appearance.setFontScale(fontScale + 0.1)}
                >
                  +
                </Button>
                {fontScale !== 1 && (
                  <IconButton
                    icon={<ArrowCounterClockwiseIcon aria-hidden="true" />}
                    title={t`Reset interface size`}
                    size="sm"
                    type="button"
                    ref={resetRef}
                    aria-label={t`Reset interface size`}
                    onClick={() => appearance.setFontScale(1)}
                  />
                )}
              </fieldset>
            }
          />
          <PreferenceRow
            title={t`Accent color`}
            trailing={(label) => (
              <fieldset
                {...label}
                className="m-0 min-w-0 max-w-full border-0 p-0"
              >
                <div
                  data-accent-colors
                  className="grid auto-cols-max grid-flow-col gap-2 overflow-x-auto p-1 scroll-p-1 [&>button]:scroll-m-1"
                >
                  {ACCENTS.map((color) => {
                    const colorLabel = accentLabels[color];
                    return (
                      <IconButton
                        key={color}
                        data-color-swatch=""
                        data-accent={color}
                        data-color-mode={mode}
                        style={accentButtonStyle}
                        variant="primary"
                        size="sm"
                        shape="round"
                        aria-label={t`${colorLabel} accent color`}
                        title={colorLabel}
                        aria-pressed={accent === color}
                        onFocus={(event) =>
                          event.currentTarget.scrollIntoView({
                            block: "nearest",
                            inline: "nearest",
                          })
                        }
                        onClick={() => appearance.setAccent(color)}
                        icon={
                          <CircleIcon
                            size={24}
                            strokeWidth={3}
                            aria-hidden="true"
                            className={
                              accent === color ? "opacity-100" : "opacity-0"
                            }
                          />
                        }
                      />
                    );
                  })}
                </div>
              </fieldset>
            )}
          />
          <PreferenceRow
            title={t`Vibe level`}
            trailing={
              <Select
                lang={i18n.locale}
                variant="compact"
                label={t`Vibe level`}
                value={contrast}
                groups={[
                  {
                    label: t`Vibe level`,
                    options: [
                      { value: "low", label: t`Chillin’` },
                      { value: "high", label: t`Buzzin’` },
                    ],
                  },
                ]}
                onValueChange={(value) => {
                  if (value === "low" || value === "high")
                    appearance.setContrast(value);
                }}
              />
            }
          />
          <PreferenceRow
            title={t`Clock`}
            subtitle={t`System uses your device’s time format.`}
            trailing={
              <Select
                lang={i18n.locale}
                variant="compact"
                label={t`Clock`}
                value={clock.hourCycle}
                groups={[
                  {
                    label: t`Clock`,
                    options: [
                      { value: "system", label: t`System` },
                      { value: "h12", label: t`12-hour` },
                      { value: "h23", label: t`24-hour` },
                    ],
                  },
                ]}
                onValueChange={(value) => {
                  if (value === "system" || value === "h12" || value === "h23")
                    setClockPreference({ hourCycle: value });
                }}
              />
            }
          />
          <SwitchPreferenceRow
            label={t`Show seconds`}
            checked={clock.seconds}
            onCheckedChange={(seconds) => setClockPreference({ seconds })}
          />
          <SwitchPreferenceRow
            label={t`Show time zone details on profiles`}
            description={t`With someone’s local time, shows how far ahead or behind you they are and their time zone.`}
            checked={clock.localTimeDetails}
            onCheckedChange={(localTimeDetails) =>
              setClockPreference({ localTimeDetails })
            }
          />
        </SettingsGroup>
      </div>
      <div className="mt-section-gap">
        <InlineHeader title={t`Conversations`} />
        <SettingsGroup>
          <PreferenceRow
            title={t`Message density`}
            subtitle={t`Compact shows conversations as a flat list that fits more messages on screen.`}
            trailing={
              <Select
                lang={i18n.locale}
                variant="compact"
                label={t`Message density`}
                value={density}
                groups={[
                  {
                    label: t`Density`,
                    options: [
                      { value: "default", label: t`Default` },
                      { value: "compact", label: t`Compact` },
                    ],
                  },
                ]}
                onValueChange={(value) => {
                  if (value === "default" || value === "compact")
                    appearance.setDensity(value);
                }}
              />
            }
          />
          {density === "default" && (
            <PreferenceRow
              title={t`Message width`}
              trailing={
                <Select
                  lang={i18n.locale}
                  variant="compact"
                  label={t`Message width`}
                  value={messageWidth}
                  groups={[
                    {
                      label: t`Width`,
                      options: [
                        { value: "narrow", label: t`Narrow` },
                        { value: "wide", label: t`Wide` },
                      ],
                    },
                  ]}
                  onValueChange={(value) => {
                    if (value === "narrow" || value === "wide")
                      appearance.setMessageWidth(value);
                  }}
                />
              }
            />
          )}
          <AppearancePreview
            messageWidth={messageWidth}
            density={density}
            embedded
          />
        </SettingsGroup>
        <div className="mt-4">
          <SettingsGroup>
            <PreferenceRow
              title={t`Message timestamps`}
              subtitle={t`Hidden times stay available to screen readers.`}
              trailing={
                <Select
                  lang={i18n.locale}
                  variant="compact"
                  label={t`Message timestamps`}
                  value={clock.messageTimestamps}
                  groups={[
                    {
                      label: t`Timestamps`,
                      options: [
                        { value: "show", label: t`Show` },
                        { value: "hide-solo", label: t`Hide in Solo chats` },
                        { value: "hide", label: t`Hide` },
                      ],
                    },
                  ]}
                  onValueChange={(value) => {
                    if (
                      value === "show" ||
                      value === "hide-solo" ||
                      value === "hide"
                    )
                      setClockPreference({ messageTimestamps: value });
                  }}
                />
              }
            />
            {verifiedCommunity && (
              <PreferenceRow
                title={t`Show people by`}
                subtitle={t`How people with verified names appear to you. Search, profiles, and previews show both.`}
                trailing={
                  <Select
                    lang={i18n.locale}
                    variant="compact"
                    label={t`Show people by`}
                    value={names}
                    groups={[
                      {
                        label: t`Name`,
                        options: [
                          { value: "username", label: t`Username` },
                          { value: "full-name", label: t`Full name` },
                        ],
                      },
                    ]}
                    onValueChange={(value) => {
                      if (value === "username" || value === "full-name")
                        setNamePreference(value);
                    }}
                  />
                }
              />
            )}
            <PreferenceRow
              title={t`Follow-up behavior`}
              subtitle={t`In Solo, send follow-ups immediately or queue them until the agent finishes its previous response.`}
              trailing={
                <Select
                  lang={i18n.locale}
                  variant="compact"
                  label={t`Follow-up behavior`}
                  value={followUp.behavior}
                  groups={[
                    {
                      label: t`Behavior`,
                      options: [
                        { value: "immediate", label: t`Send immediately` },
                        { value: "queue", label: t`Queue` },
                      ],
                    },
                  ]}
                  onValueChange={(value) => {
                    if (value === "immediate" || value === "queue")
                      setFollowUpBehaviorPreference(value);
                  }}
                />
              }
            />

            <PreferenceRow
              title={t`Open threads in`}
              subtitle={t`New threads open here. Already-open threads stay where you placed them.`}
              trailing={
                <Select
                  lang={i18n.locale}
                  variant="compact"
                  label={t`Open threads in`}
                  value={placement}
                  groups={[
                    {
                      label: t`Pane`,
                      options: [
                        { value: "side", label: t`Side pane` },
                        { value: "main", label: t`Main pane` },
                      ],
                    },
                  ]}
                  onValueChange={(value) => {
                    if (value === "main" || value === "side")
                      setThreadPlacementPreference(value);
                  }}
                />
              }
            />
            {autocorrectAvailable && (
              <SwitchPreferenceRow
                label={t`Allow automatic spelling correction`}
                description={t`Lets macOS correct misspelled words in messages. Turn correction on or off from the message box’s Spelling and Grammar menu.`}
                checked={autocorrect.enabled}
                onCheckedChange={setMessageAutocorrectPreference}
              />
            )}
            <SwitchPreferenceRow
              label={t`Show unread first in search`}
              description={t`With nothing typed, search leads with unread channels and DMs and selects the newest.`}
              checked={unreadFirst.enabled}
              onCheckedChange={setUnreadFirstPreference}
            />
          </SettingsGroup>
        </div>
        {active && messageWidthError && (
          <ToastNotice
            lang={i18n.locale}
            title={t`Message width wasn’t saved`}
            description={messageWidthError}
          >
            <Button
              size="sm"
              onClick={() => appearance.setMessageWidth(messageWidth)}
            >{t`Retry saving message width`}</Button>
          </ToastNotice>
        )}
        {active && followUp.unsaved && (
          <ToastNotice
            lang={i18n.locale}
            title={t`Follow-up preference wasn’t saved`}
            description={t`This choice is active, but could not be saved on this device.`}
          >
            <Button
              size="sm"
              onClick={() => setFollowUpBehaviorPreference(followUp.behavior)}
            >{t`Retry saving follow-up behavior`}</Button>
          </ToastNotice>
        )}
        {active && clock.unsaved && (
          <ToastNotice
            lang={i18n.locale}
            title={t`Clock preference wasn’t saved`}
            description={t`This choice is active, but could not be saved on this device. Try again.`}
          >
            <Button
              type="button"
              size="sm"
              onClick={() => setClockPreference({})}
            >{t`Retry saving clock preference`}</Button>
          </ToastNotice>
        )}
        {active && autocorrect.unsaved && (
          <ToastNotice
            lang={i18n.locale}
            title={t`Spelling preference wasn’t saved`}
            description={t`This choice is active, but could not be saved on this device. Try again.`}
          >
            <Button
              type="button"
              size="sm"
              onClick={() =>
                setMessageAutocorrectPreference(autocorrect.enabled)
              }
            >{t`Retry saving spelling correction`}</Button>
          </ToastNotice>
        )}
        {active && unreadFirst.unsaved && (
          <ToastNotice
            lang={i18n.locale}
            title={t`Search preference wasn’t saved`}
            description={t`This choice is active, but could not be saved on this device. Try again.`}
          >
            <Button
              type="button"
              size="sm"
              onClick={() => setUnreadFirstPreference(unreadFirst.enabled)}
            >{t`Retry saving search preference`}</Button>
          </ToastNotice>
        )}
        {active && unsaved && (
          <ToastNotice
            lang={i18n.locale}
            title={t`Thread preference wasn’t saved`}
            description={t`This choice is active, but could not be saved on this device. Try again.`}
          >
            <Button
              type="button"
              size="sm"
              onClick={() => setThreadPlacementPreference(placement)}
            >{t`Retry saving thread placement`}</Button>
          </ToastNotice>
        )}
        {active && contrastError && (
          <ToastNotice
            lang={i18n.locale}
            title={t`Vibe level wasn’t saved`}
            description={contrastError}
          >
            <Button
              size="sm"
              onClick={() => appearance.setContrast(contrast)}
            >{t`Retry saving vibe level`}</Button>
          </ToastNotice>
        )}
        {active && densityError && (
          <ToastNotice
            lang={i18n.locale}
            title={t`Message density wasn’t saved`}
            description={densityError}
          >
            <Button
              size="sm"
              onClick={() => appearance.setDensity(density)}
            >{t`Retry saving message density`}</Button>
          </ToastNotice>
        )}
        {active && accentError && (
          <ToastNotice
            lang={i18n.locale}
            title={t`Accent color wasn’t saved`}
            description={accentError}
          >
            <Button
              size="sm"
              onClick={() => appearance.setAccent(accent)}
            >{t`Retry saving accent color`}</Button>
          </ToastNotice>
        )}

        {active && fontError && (
          <ToastNotice
            lang={i18n.locale}
            title={t`Interface size wasn’t saved`}
            description={fontError}
          >
            <Button
              type="button"
              size="sm"
              onClick={() => appearance.setFontScale(fontScale)}
            >{t`Retry saving interface size`}</Button>
          </ToastNotice>
        )}
        {active && error && (
          <ToastNotice
            lang={i18n.locale}
            title={t`Appearance wasn’t saved`}
            description={error}
          >
            <Button
              type="button"
              size="sm"
              onClick={() => appearance.setMode(preference)}
            >{t`Retry saving appearance`}</Button>
          </ToastNotice>
        )}
      </div>
    </section>
  );
}
