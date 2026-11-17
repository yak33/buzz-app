import { useLingui } from "@lingui/react/macro";
import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { InlineHeader } from "../shared/design-system/ui/Header";
import { ToastNotice } from "../shared/design-system/ui/Toast";
import { useSyncExternalStore } from "react";
import type { UnreadIndicator } from "../features/notifications/indicator";
import { Button } from "../shared/design-system/ui/Button";
import { usePermissionCheck } from "./usePermissionCheck";

export function UnreadIndicatorSettings({
  indicator,
  active = true,
}: {
  indicator: UnreadIndicator;
  active?: boolean;
}) {
  const { t, i18n } = useLingui();
  const state = useSyncExternalStore(indicator.subscribe, indicator.snapshot);
  const [checking, checkPermission] = usePermissionCheck(indicator.refresh);
  if (!indicator.available) return null;
  return (
    <div lang={i18n.locale} className="space-y-3">
      <InlineHeader title={t`Dock unread badge`} />
      <SettingsGroup layout="form">
        <p className="text-body-sm text-subtle">
          {state.permission === "unavailable"
            ? t`Dock badges require a bundled macOS app and aren’t available from the development server.`
            : t`Shows a dot for unread activity in the selected community. It doesn’t show a message count.`}
        </p>
        {state.permission !== "unavailable" && (
          <p role="status" className="text-body-sm text-muted">
            {state.requesting
              ? t`Waiting for system permission…`
              : {
                  default: t`Allow notifications and badges to show the unread dot.`,
                  setup: t`Set up Dock badges to show the unread dot.`,
                  enabled: t`Buzz can show Dock badges.`,
                  disabled: t`Dock badges are off. Turn them on in macOS System Settings.`,
                  denied: t`Notifications are off. Turn them on in macOS System Settings.`,
                }[state.permission]}
          </p>
        )}
        {state.permission !== "unavailable" && (
          <div className="flex flex-wrap gap-2">
            {(state.permission === "default" ||
              state.permission === "setup") && (
              <Button
                type="button"
                disabled={state.requesting}
                onClick={() => void indicator.request()}
              >
                {state.permission === "setup"
                  ? t`Set up Dock badges`
                  : t`Allow notifications and badges`}
              </Button>
            )}
            <Button
              type="button"
              disabled={state.requesting}
              loading={checking}
              onClick={checkPermission}
            >{t`Check Dock permission`}</Button>
          </div>
        )}
      </SettingsGroup>
      {active && state.error && (
        <ToastNotice
          lang={i18n.locale}
          title={t`Dock badge unavailable`}
          description={state.error}
        />
      )}
    </div>
  );
}
