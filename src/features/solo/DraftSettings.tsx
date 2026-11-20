import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { ChannelDurationField } from "../../bundled/channels/ChannelDurationField";
import {
  canonicalDetailsName,
  detailsDraftErrors,
} from "../relay/channel-details-protocol";
import { DEFAULT_TEMPORARY_CHANNEL_TTL_SECONDS } from "../relay/channel-writes";
import { useEffect, useState, type ComponentProps } from "react";
import type { RelaySession } from "../relay/session";
import type { Dialog } from "../../shared/design-system/ui/Dialog";
import { Button } from "../../shared/design-system/ui/Button";
import { Field } from "../../shared/design-system/ui/Field";
import { Input } from "../../shared/design-system/ui/Input";
import {
  emptyWorkspace,
  loadChatSetup,
  readWorkspace,
  workspaceCanvas,
} from "./workspace";
import {
  ChatInstructions,
  ChatSettingsDialog,
  instructionsCanvas,
} from "./ChatSettingsDialog";

/** Edits only the local draft; first-send owns remote setup and its retry receipt. */
export function DraftSettings({
  session,
  projectId,
  canvas,
  name = "",
  save,
  close,
  ttlSeconds,
  finalFocus,
}: {
  session: RelaySession;
  projectId?: string | undefined;
  canvas?: string | undefined;
  name?: string | undefined;
  ttlSeconds?: number | undefined;
  finalFocus?: ComponentProps<typeof Dialog>["finalFocus"];
  /** Returns false when the device couldn't store the updated settings. */
  save(canvas: string, ttlSeconds?: number, name?: string): boolean | undefined;
  close(): void;
}) {
  const { i18n, t } = useLingui();
  // A persisted name arrives unchecked; a malformed one opens blank.
  const openedName = typeof name === "string" ? name : "";
  const [value, setValue] = useState(openedName);
  const normalized = canonicalDetailsName(value);
  const invalidName =
    normalized !== "" &&
    detailsDraftErrors({
      name: normalized,
      description: "",
      visibility: "private",
    }).name;
  const nameError = invalidName
    ? t`Use a chat name of at most 120 characters.`
    : undefined;
  const [ttl, setTtl] = useState(ttlSeconds);
  const [temporaryTtl, setTemporaryTtl] = useState(
    ttlSeconds ?? DEFAULT_TEMPORARY_CHANNEL_TTL_SECONDS,
  );
  const invalidLifetime = detailsDraftErrors({
    name: "Chat",
    description: "",
    visibility: "private",
    ttlSeconds: ttl,
  }).lifetime;
  const lifetimeError = invalidLifetime
    ? t`Channel duration could not be verified.`
    : undefined;
  const [workspace, setWorkspace] = useState(emptyWorkspace);
  const [raw, setRaw] = useState<string>();
  // The Canvas the dialog opened with; undefined until it has loaded.
  const [opened, setOpened] = useState<string>();
  const loaded = opened !== undefined;
  const [error, setError] = useState<string | MessageDescriptor>("");
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt explicitly retries a failed settings read.
  useEffect(() => {
    let active = true;
    setError("");
    void (async () => {
      try {
        const content =
          canvas ??
          (projectId ? (await loadChatSetup(session, projectId)).canvas : "");
        if (!active) return;
        try {
          setWorkspace(readWorkspace(content));
        } catch {
          setRaw(content);
        }
        setOpened(content);
      } catch (reason) {
        if (active)
          setError(reason instanceof Error ? reason.message : String(reason));
      }
    })();
    return () => {
      active = false;
    };
  }, [session, projectId, canvas, attempt]);
  return (
    <ChatSettingsDialog
      lang={i18n.locale}
      dismissOnOutsideClick={false}
      dirty={
        canonicalDetailsName(value) !== canonicalDetailsName(openedName) ||
        ttl !== ttlSeconds ||
        (loaded && instructionsCanvas(workspace, raw) !== opened)
      }
      finalFocus={finalFocus}
      close={close}
      saveDisabled={!loaded || !!nameError || !!lifetimeError}
      onSave={() => {
        try {
          const saved = save(
            raw === undefined
              ? workspaceCanvas(workspace)
              : workspaceCanvas({ folders: [], canvas: raw }),
            ttl,
            normalized,
          );
          if (saved === false) {
            setError(
              msg`Settings couldn’t be saved on this device. Try again.`,
            );
            return;
          }
          close();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      }}
    >
      <Field
        label={t`Chat name`}
        optional
        optionalLabel={t`Optional`}
        error={nameError}
      >
        <Input
          value={value}
          lang=""
          disabled={!loaded}
          onChange={(event) => setValue(event.target.value)}
        />
      </Field>
      {loaded ? (
        <ChatInstructions
          workspace={workspace}
          onWorkspaceChange={setWorkspace}
          raw={raw}
          onRawChange={setRaw}
        />
      ) : (
        !error && <p role="status">{t`Loading settings…`}</p>
      )}
      <ChannelDurationField
        label={t`Lifetime`}
        temporary={ttl !== undefined}
        ttlSeconds={temporaryTtl}
        disabled={!loaded}
        error={lifetimeError}
        onChange={(next) => {
          setTtl(next);
          if (next !== undefined) setTemporaryTtl(next);
        }}
      />
      {error && (
        <p role="alert" lang={typeof error === "string" ? "" : i18n.locale}>
          {typeof error === "string" ? error : i18n._(error)}
        </p>
      )}
      {!loaded && error && (
        <Button onClick={() => setAttempt((value) => value + 1)}>
          {t`Retry settings`}
        </Button>
      )}
    </ChatSettingsDialog>
  );
}
