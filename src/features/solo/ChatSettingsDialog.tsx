import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "../../shared/design-system/ui/Button";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { Field } from "../../shared/design-system/ui/Field";
import { Textarea } from "../../shared/design-system/ui/Textarea";
import { DiscardChanges } from "../agents/AgentSaveButton";
import { workspaceCanvas, type Workspace } from "./workspace";
import { WorkspaceFields } from "./WorkspaceFields";
import styles from "./WorkspaceSettings.module.css";

/** One settings surface for drafts, chats and projects; callers own loading and saving. */
export function ChatSettingsDialog({
  title,
  finalFocus,
  close,
  busy = false,
  saveLabel,
  saveDisabled = false,
  saveLoading = false,
  dismissOnOutsideClick = true,
  dirty = false,
  lang,
  onSave,
  children,
}: {
  title?: string | undefined;
  lang?: string | undefined;
  finalFocus?: ComponentProps<typeof Dialog>["finalFocus"];
  close(): void;
  /** A pending save blocks dismissal and edits. */
  busy?: boolean;
  saveLabel?: string;
  saveDisabled?: boolean;
  saveLoading?: boolean;
  dismissOnOutsideClick?: boolean;
  /** Escape, Close and outside clicks ask before dropping edits; Cancel discards. */
  dirty?: boolean;
  onSave(): void;
  children: ReactNode;
}) {
  const { i18n, t } = useLingui();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  return (
    <Dialog
      open
      finalFocus={finalFocus}
      onOpenChange={(open) => {
        if (open) return;
        if (dirty) setConfirmDiscard(true);
        else close();
      }}
      preventClose={busy}
      dismissOnOutsideClick={dismissOnOutsideClick}
      size="wide"
      {...(lang === undefined ? {} : { lang })}
      title={title ?? t`Edit chat`}
      actions={
        <>
          <Button disabled={busy} onClick={close}>
            <span lang={i18n.locale}>{t`Cancel`}</span>
          </Button>
          <Button
            variant="prominent"
            loading={saveLoading}
            disabled={saveDisabled}
            onClick={onSave}
          >
            <span lang={i18n.locale}>{saveLabel ?? t`Save changes`}</span>
          </Button>
        </>
      }
    >
      <div className={styles.sections} inert={busy}>
        {children}
      </div>
      {confirmDiscard && (
        <DiscardChanges
          description={i18n._(msg`Your settings have unsaved changes.`)}
          lang={i18n.locale}
          onKeep={() => setConfirmDiscard(false)}
          onDiscard={close}
        />
      )}
    </Dialog>
  );
}

/** The Canvas ChatInstructions would save; undefined while it's invalid. */
export function instructionsCanvas(
  workspace: Workspace,
  raw: string | undefined,
) {
  try {
    return raw ?? workspaceCanvas(workspace);
  } catch {
    return undefined;
  }
}

/** Structured workspace fields, or the raw Canvas when it can't be parsed. */
export function ChatInstructions({
  workspace,
  onWorkspaceChange,
  raw,
  onRawChange,
}: {
  workspace: Workspace;
  onWorkspaceChange(value: Workspace): void;
  raw: string | undefined;
  onRawChange(value: string): void;
}) {
  const { t } = useLingui();
  return raw === undefined ? (
    <WorkspaceFields
      value={workspace}
      onChange={onWorkspaceChange}
      instructionRows={10}
    />
  ) : (
    <Field
      label={t`Instructions`}
      description={t`These instructions have custom workspace setup. Edit them directly to keep it.`}
    >
      <Textarea
        rows={12}
        value={raw}
        lang=""
        onChange={(event) => onRawChange(event.target.value)}
      />
    </Field>
  );
}
