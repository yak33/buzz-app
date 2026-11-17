import { useLingui } from "@lingui/react/macro";
import { useRef, useState } from "react";
import { CommunityDialog } from "../features/communities/CommunityDialog";
import { CommunityRepositoriesSettings } from "./CommunityRepositoriesSettings";
import { DefaultLifetimeSettings } from "../features/solo/DefaultLifetimeSettings";
import { relayPartition } from "../features/relay/partition";
import type { Communities, Membership } from "../features/communities/service";
import { communityDestination } from "../features/communities/destination";
import {
  COMMUNITY_NAME_MAX_LENGTH,
  communityDefaultName,
} from "../features/communities/names";
import { Header } from "../shared/design-system/ui/Header";
import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { Field } from "../shared/design-system/ui/Field";
import { Input } from "../shared/design-system/ui/Input";
import { Button } from "../shared/design-system/ui/Button";
import { useToastNotification } from "../shared/design-system/ui/Toast";
import { writeClipboardText } from "../shared/clipboard";

/** Captured viewer/community; never saves into a newly selected destination. */
export function CommunityLocalSettings({
  communities,
  community,
  viewer,
}: {
  communities: Communities;
  community: Membership;
  viewer: string | undefined;
}) {
  const { t, i18n } = useLingui();
  const notify = useToastNotification();
  const address = communityDestination(community.id).url;
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState("");
  const copyUrl = async () => {
    if (copying) return;
    setCopying(true);
    setCopyError("");
    try {
      await writeClipboardText(address);
      notify(t`Community URL copied.`, "success");
    } catch {
      setCopyError(t`Couldn’t copy the URL. Select it and copy manually.`);
    } finally {
      setCopying(false);
    }
  };
  const [editingConnection, setEditingConnection] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const value = draft ?? community.localName ?? "";
  const changed = value.trim() !== (community.localName ?? "");
  const save = (value: string) => {
    setSaved(false);
    try {
      if (!viewer)
        throw new Error(
          t`Your account is unavailable. Open Local settings again.`,
        );
      communities.setLocalName(community.id, viewer, value);
      setDraft(null);
      setError("");
      setSaved(true);
      if (nameInput.current?.form?.contains(document.activeElement))
        nameInput.current.focus();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t`Couldn’t save the display name. Try again.`,
      );
    }
  };
  return (
    <section
      lang={i18n.locale}
      aria-labelledby="community-local-settings-title"
    >
      <Header
        id="community-local-settings-title"
        title={t`Local settings`}
        subtitle={t`Settings only apply on this device.`}
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (changed) save(value);
        }}
      >
        <SettingsGroup layout="form">
          <Field
            label={t`Display name`}
            description={t`This name is only visible to you. Other users can’t see your display name for this community.`}
            error={error}
          >
            <Input
              ref={nameInput}
              value={value}
              placeholder={communityDefaultName(community)}
              maxLength={COMMUNITY_NAME_MAX_LENGTH}
              onValueChange={(value) => {
                setDraft(value);
                setError("");
                setSaved(false);
              }}
            />
          </Field>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              disabled={!community.localName && !draft}
              onClick={() => save("")}
            >{t`Reset name`}</Button>
            <Button
              type="button"
              disabled={draft === null}
              onClick={() => {
                setDraft(null);
                setError("");
                setSaved(false);
                nameInput.current?.focus();
              }}
            >{t`Cancel`}</Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!changed}
            >{t`Save`}</Button>
          </div>
          {saved && (
            <p
              role="status"
              className="m-0 text-body-sm text-muted"
            >{t`Display name saved on this device.`}</p>
          )}
        </SettingsGroup>
      </form>
      {viewer && (
        <div className="mt-section-gap">
          <DefaultLifetimeSettings scope={relayPartition(address, viewer)} />
        </div>
      )}
      <CommunityRepositoriesSettings
        communities={communities}
        community={community.id}
        viewer={viewer}
      />
      <div className="mt-section-gap">
        <SettingsGroup layout="form">
          <Field
            label={t`Community address`}
            description={t`This is the relay URL you use to connect to this community.`}
          >
            <Input value={address} readOnly />
          </Field>
          {copyError && (
            <p role="alert" className="m-0 text-body-sm text-danger">
              {copyError}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              size="xs"
              loading={copying}
              onClick={() => void copyUrl()}
            >{t`Copy URL`}</Button>
            <Button
              type="button"
              size="xs"
              disabled={!viewer || !communities.snapshot().relayAvailable}
              onClick={() => setEditingConnection(true)}
            >{t`Edit connection`}</Button>
          </div>
        </SettingsGroup>
      </div>
      {editingConnection && (
        <CommunityDialog
          communities={communities}
          mode="join"
          connectionFrom={address}
          close={() => setEditingConnection(false)}
        />
      )}
    </section>
  );
}
