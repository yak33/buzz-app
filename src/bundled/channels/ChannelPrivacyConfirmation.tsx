import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react/macro";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Checkbox } from "../../shared/design-system/ui/Checkbox";
import { readView, writeView } from "../../shared/view-state";

type Visibility = "private" | "public";
const preferenceKey = "channel-privacy-confirmation:dismissed";

// View intent only: Create warnings in both directions, never authorization.
export function skipPrivacyConfirmation(scope: string) {
  // Honor opt-outs saved before the two directions shared one preference.
  return [
    preferenceKey,
    "channel-privacy-confirmation:private:dismissed",
    "channel-privacy-confirmation:public:dismissed",
  ].some((key) => readView<unknown>(scope, key, false) === true);
}

export function rememberPrivacyConfirmation(scope: string) {
  writeView(scope, preferenceKey, true);
}

/** Returns a descriptor so both callers translate at their own render site. */
export function privacyConsequence(visibility: Visibility): MessageDescriptor {
  return visibility === "private"
    ? msg`Only channel members will have access.`
    : msg`Everyone in this community will be able to view this channel’s full history.`;
}

export function ChannelPrivacyConfirmation({
  visibility,
  checked,
  onCheckedChange,
  hidePreference = false,
}: {
  hidePreference?: boolean;
  visibility: Visibility;
  checked: boolean;
  onCheckedChange(checked: boolean): void;
}) {
  const { i18n, t } = useLingui();
  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <BaseDialog.Description>
        {i18n._(privacyConsequence(visibility))}
      </BaseDialog.Description>
      {!hidePreference && (
        <Checkbox
          label={t`Don’t show me this again`}
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      )}
    </div>
  );
}
