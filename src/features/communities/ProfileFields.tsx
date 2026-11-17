import { useLingui } from "@lingui/react/macro";
import { useState, type Ref } from "react";
import { Field } from "../../shared/design-system/ui/Field";
import { Input } from "../../shared/design-system/ui/Input";
import { AvatarEditor } from "../profiles/AvatarEditor";
import { profilePictureError } from "../profiles/avatar-upload";
import type { PersonalProfile } from "./service";
import type { VerifiedProfile } from "../relay/verified-profile";
import { PROFILE_ABOUT_MAX_LENGTH } from "./service";
import { Textarea } from "../../shared/design-system/ui/Textarea";

export function profilesEqual(left: PersonalProfile, right: PersonalProfile) {
  return (
    left.name === right.name &&
    left.picture === right.picture &&
    (left.about ?? "") === (right.about ?? "")
  );
}

export function canSaveProfile(profile: PersonalProfile) {
  return (
    !!profile.name.trim() &&
    !profilePictureError(profile.picture) &&
    (profile.about?.length ?? 0) <= PROFILE_ABOUT_MAX_LENGTH
  );
}

export function ProfileFields({
  profile,
  onChange,
  disabled = false,
  community,
  onBusyChange,
  showAvatar = true,
  showAbout = true,
  emptyAvatarStyle,
  autoFocus = false,
  nameRef,
  verifiedName,
}: {
  profile: PersonalProfile;
  onChange(profile: PersonalProfile): void;
  disabled?: boolean;
  community?: string | undefined;
  onBusyChange?(busy: boolean): void;
  showAvatar?: boolean;
  showAbout?: boolean;
  emptyAvatarStyle?: "dotted-circle";
  /** Focuses the display name on mount, for pages whose only task is this form. */
  autoFocus?: boolean;
  nameRef?: Ref<HTMLInputElement>;
  /** A relay-verified name replaces the editable display name. */
  verifiedName?:
    | {
        name: string;
        username?: string;
        issuerLabel: string;
        status: VerifiedProfile["status"];
      }
    | undefined;
}) {
  const { t, i18n } = useLingui();
  const aboutLength = profile.about?.length ?? 0;
  // A simplified form must still let people repair an invalid saved description.
  const [repairAbout] = useState(
    () => (profile.about?.length ?? 0) > PROFILE_ABOUT_MAX_LENGTH,
  );
  return (
    <div lang={i18n.locale} className="grid gap-4">
      {showAvatar && (
        <div lang="en">
          <AvatarEditor
            personal
            emptyStyle={emptyAvatarStyle}
            value={profile.picture}
            name={profile.name}
            community={community}
            disabled={disabled}
            onBusyChange={onBusyChange}
            onChange={(picture) => onChange({ ...profile, picture })}
          />
        </div>
      )}
      <Field
        label={t`Display name`}
        description={
          verifiedName
            ? `${
                verifiedName.status === "checked"
                  ? t`Name verified by ${verifiedName.issuerLabel}`
                  : t`Cached verification from ${verifiedName.issuerLabel}`
              }${
                verifiedName.username &&
                verifiedName.username !== verifiedName.name
                  ? ` · @${verifiedName.username}`
                  : ""
              }`
            : undefined
        }
      >
        <Input
          lang=""
          ref={nameRef}
          autoComplete="nickname"
          spellCheck={false}
          autoFocus={autoFocus}
          required
          disabled={disabled}
          readOnly={!!verifiedName}
          value={verifiedName?.name ?? profile.name}
          maxLength={100}
          onChange={(event) =>
            onChange({ ...profile, name: event.target.value })
          }
        />
      </Field>
      {(showAbout || repairAbout) && (
        <Field
          label={t`Profile description (optional)`}
          description={t`${aboutLength} of ${PROFILE_ABOUT_MAX_LENGTH} characters`}
          error={
            (profile.about?.length ?? 0) > PROFILE_ABOUT_MAX_LENGTH
              ? t`Shorten the description to ${PROFILE_ABOUT_MAX_LENGTH} characters before saving.`
              : undefined
          }
        >
          <Textarea
            lang=""
            rows={3}
            disabled={disabled}
            value={profile.about ?? ""}
            onChange={(event) =>
              onChange({ ...profile, about: event.target.value })
            }
          />
        </Field>
      )}
    </div>
  );
}
