import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import {
  useEffect,
  useId,
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  WorkflowCapability,
  WorkflowDefinition,
} from "../../features/workflows/types";
import { PlayIcon, TrashIcon } from "../../shared/design-system/icons";
import {
  MenuIcon,
  MenuItem,
  MenuNote,
} from "../../shared/design-system/ui/Menu";
import { Button } from "../../shared/design-system/ui/Button";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { ConfirmAction } from "./ConfirmAction";
import { WorkflowEditor } from "./WorkflowEditor";
import { messages, WorkflowOperations } from "./WorkflowOperations";
import { WorkflowRuns } from "./WorkflowRuns";
import { ARCHIVED_REASON, saveAwaitsReadback } from "./WorkflowLanding";
import { exactSaveReadback } from "./editor-model";
import { DEFAULT_FORM_STATE, formStateToYaml } from "./workflowFormTypes";
import { useWorkflowView } from "./useWorkflowView";
import { useWorkflowCanDelete } from "./useWorkflowCanDelete";
import { readWorkflowDocumentFields } from "./workflowYamlDocument";
import {
  type ChannelLabel,
  channelIcon,
} from "../../features/channels/channel-icon";
import type { ChannelSummary } from "../../features/relay/contracts";

type Draft = {
  editorKey: number;
  original: WorkflowDefinition | undefined;
  yaml: string;
  initial: string;
  operationId?: string;
};

function draftFor(next: WorkflowDefinition | "new", editorKey: number): Draft {
  const yaml =
    next === "new"
      ? formStateToYaml({ ...DEFAULT_FORM_STATE, name: "Untitled workflow" })
      : next.yaml;
  return {
    editorKey,
    original: next === "new" ? undefined : next,
    yaml,
    initial: yaml,
  };
}

export function WorkflowChannel({
  capability,
  channelId,
  channel,
  initialSelection,
  viewer,
  onDraftRiskChange,
  onSaveReadback,
  onClose,
  onDelete,
}: {
  capability: WorkflowCapability;
  channelId: string;
  channel: ChannelLabel & Pick<ChannelSummary, "archived">;
  initialSelection: WorkflowDefinition | "new";
  viewer: string;
  onDraftRiskChange?: (atRisk: boolean) => void;
  onSaveReadback?: (
    saved: Pick<WorkflowDefinition, "channelId" | "revision">,
  ) => void;
  onClose: () => void;
  onDelete: (definition: WorkflowDefinition) => void;
}) {
  const { i18n, t } = useLingui();
  const { snapshot, refresh } = useWorkflowView(
    useCallback(
      () => capability.definitions(channelId),
      [capability, channelId],
    ),
  );
  const operations = useSyncExternalStore(
    capability.operations.subscribe,
    capability.operations.snapshot,
    capability.operations.snapshot,
  );
  const submission = useRef<string | null>(null);
  const deleteReasonId = useId();
  const archivedReasonId = useId();
  const editorGeneration = useRef(0);
  const [draft, setDraft] = useState<Draft | null>(() =>
    draftFor(initialSelection, 0),
  );
  const [pendingSelection, setPendingSelection] = useState<
    WorkflowDefinition | "new" | "close" | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdRun, setCreatedRun] = useState<string>();
  const [runRequest, setRunRequest] = useState<string>();
  const operation = draft?.operationId
    ? operations.find((item) => item.eventId === draft.operationId)
    : undefined;
  const runOperation = runRequest
    ? operations.find((item) => item.eventId === runRequest)
    : undefined;
  const ownOperations = operations.filter(
    (item) => item.workflow.channelId === channelId,
  );
  const busy =
    !!draft?.operationId && (!operation || operation.outcome === "pending");
  const [localDraftAtRisk, setLocalDraftAtRisk] = useState(false);
  const readonly = !!draft?.original && draft.original.owner !== viewer;
  const canDelete = useWorkflowCanDelete(capability, draft?.original);
  const dirty = !!draft && (draft.yaml !== draft.initial || localDraftAtRisk);
  const draftFields = draft && readWorkflowDocumentFields(draft.yaml);
  // The relay accepts this save, but every run of the workflow would fail.
  // An omitted or unreadable `enabled` counts as on, as the switch shows it.
  const archivedEnabled =
    !!channel.archived && !!draftFields && draftFields.enabled !== false;
  const atRisk = dirty || !!draft?.operationId;
  // A run request never changes configuration, so its lost receipt cannot
  // leave a configuration write unresolved; nor can a save a newer head replaced.
  const unresolved = ownOperations.filter((item) => {
    const original = draft?.original;
    if (!original)
      return (
        item.action === "save" &&
        item.outcome !== "rejected" &&
        item.outcome !== "succeeded"
      );
    if (
      item.workflow.id !== original.id ||
      item.workflow.owner !== original.owner
    )
      return false;
    if (item.outcome === "pending") return true;
    if (item.action === "delete") return item.outcome !== "rejected";
    return (
      item.action === "save" &&
      item.outcome === "unknown" &&
      saveAwaitsReadback(item, original)
    );
  });
  const unresolvedWrite = unresolved.length > 0;
  useEffect(() => {
    onDraftRiskChange?.(atRisk);
    return () => onDraftRiskChange?.(false);
  }, [atRisk, onDraftRiskChange]);
  useEffect(() => {
    if (!atRisk) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [atRisk]);
  const open = (next: WorkflowDefinition | "new" | "close") => {
    if (next === "close") {
      onClose();
      return;
    }
    setLocalDraftAtRisk(false);
    // Explicit replacement discards local form state even for the same revision.
    setDraft(draftFor(next, ++editorGeneration.current));
    submission.current = null;
    setRunRequest(undefined);
    setError(null);
    setPendingSelection(null);
    setConfirmDelete(false);
  };
  const select = (next: WorkflowDefinition | "new" | "close") => {
    if (atRisk) setPendingSelection(next);
    else open(next);
  };
  useEffect(() => {
    if (operation?.eventId && operation.outcome === "succeeded") void refresh();
  }, [operation?.eventId, operation?.outcome, refresh]);
  useEffect(() => {
    if (!operation || !draft || snapshot?.status !== "ready") return;
    const saved = exactSaveReadback(operation, snapshot.data.items);
    if (saved) {
      submission.current = null;
      onSaveReadback?.({
        channelId: saved.channelId,
        revision: saved.revision,
      });
      // Readback updates the draft, not its modal lifetime: remounting would
      // steal focus from a one-time secret dialog delivered by the same save.
      setDraft({
        editorKey: draft.editorKey,
        original: saved,
        yaml: saved.yaml,
        initial: saved.yaml,
      });
    }
  }, [operation, snapshot, draft, onSaveReadback]);
  // A cleared/unavailable view withdraws the saved private definition from display.
  // Unsaved user-authored drafts never become a second retained definition cache.
  useEffect(() => {
    if (snapshot?.status === "unavailable" || snapshot?.status === "idle") {
      submission.current = null;
      setDraft(null);
      setPendingSelection(null);
      setConfirmDelete(false);
      setError(null);
    }
  }, [snapshot?.status]);
  const dismiss = async (eventId: string) => {
    await capability.operations.dismiss(eventId);
    if (submission.current === eventId) submission.current = null;
    setDraft((current) => {
      if (current?.operationId !== eventId) return current;
      const { operationId: _, ...retained } = current;
      return retained;
    });
  };
  const save = () => {
    if (
      !draft ||
      submission.current ||
      busy ||
      unresolvedWrite ||
      readonly ||
      archivedEnabled ||
      !capability.availability.save ||
      draft.operationId
    )
      return;
    try {
      submission.current = "submitting";
      const operationId = capability.save({
        channelId,
        yaml: draft.yaml,
        ...(draft.original ? { existing: draft.original } : {}),
      });
      submission.current = operationId;
      setDraft({ ...draft, operationId });
      setError(null);
    } catch (cause) {
      submission.current = null;
      setError(
        cause instanceof Error
          ? cause.message
          : i18n._(
              msg`The workflow could not be submitted. Your draft is retained.`,
            ),
      );
    }
  };
  const remove = () => {
    if (
      !draft?.original ||
      submission.current ||
      unresolvedWrite ||
      draft.operationId
    )
      return;
    if (
      !capability.permissions.canDelete(draft.original) ||
      !capability.availability.delete
    ) {
      setConfirmDelete(false);
      setError(
        capability.availability.delete
          ? i18n._(
              msg`You no longer have permission to delete this workflow. Refresh and try again.`,
            )
          : i18n._(msg`Workflow deletion is unavailable on this connection.`),
      );
      return;
    }
    // The page owns submission and recovery after this editor is discarded.
    const definition = draft.original;
    setDraft(null);
    setLocalDraftAtRisk(false);
    setPendingSelection(null);
    setConfirmDelete(false);
    onDelete(definition);
  };

  const trigger = () => {
    if (
      !draft?.original ||
      channel.archived ||
      submission.current ||
      dirty ||
      unresolvedWrite ||
      draft.operationId ||
      readonly ||
      !capability.availability.trigger
    )
      return;
    try {
      submission.current = "submitting";
      const eventId = capability.trigger(draft.original);
      submission.current = eventId;
      setRunRequest(eventId);
      setError(null);
    } catch (cause) {
      submission.current = null;
      setError(
        cause instanceof Error
          ? cause.message
          : i18n._(msg`Run could not be submitted.`),
      );
    }
  };
  useEffect(() => {
    const active = operations.find(
      (item) => item.eventId === submission.current,
    );
    if (
      active?.action !== "trigger" ||
      (active.outcome !== "succeeded" &&
        active.outcome !== "rejected" &&
        active.outcome !== "unknown")
    )
      return;
    submission.current = null;
    // A created run rereads the history behind the Runs tab.
    if (active.runId) setCreatedRun(active.runId);
  }, [operations]);
  let blocked: string | undefined;
  if (!capability.availability.save)
    blocked = t`Saving is unavailable from this host.`;
  else if (unresolvedWrite && !draft?.operationId)
    blocked = unresolved.every((item) => item.action === "trigger")
      ? i18n._(messages.trigger.pending)
      : t`Check saved configuration or review Recent activity before continuing.`;
  else if (draft?.operationId)
    blocked =
      operation?.outcome === "succeeded"
        ? t`Configuration saved; waiting for a readback of this exact revision. Check saved configuration or review the current version in Recent activity.`
        : operation?.outcome === "rejected"
          ? t`Draft retained. Review the error below before continuing.`
          : undefined;
  // Unreadable YAML keeps the editor's own "Correct the YAML" reason.
  else if (archivedEnabled && draftFields?.editable)
    blocked = `${i18n._(ARCHIVED_REASON)} ${t`Turn this workflow off to save it.`}`;
  if (!snapshot) return <p role="status">{t`Reading configurations…`}</p>;
  const ChannelIcon = channelIcon(channel);
  return (
    <section aria-label={t`Workflows in ${channel.name}`}>
      {snapshot.status === "loading" && !snapshot.data.items.length && (
        <p role="status">{t`Reading configurations…`}</p>
      )}
      {snapshot.status === "idle" && (
        <p role="status">{t`Configurations cleared. Refresh to read again.`}</p>
      )}
      {snapshot.status === "unavailable" && (
        <p role="status">{t`Workflow definitions are unavailable.`}</p>
      )}
      {snapshot.status === "error" && (
        <p role="alert" className="text-danger">
          {snapshot.error ??
            t`Configurations could not be read. Use Refresh configurations to retry.`}
        </p>
      )}
      {snapshot.data.partial && (
        <p className="text-secondary">{t`This is a bounded, partial list.`}</p>
      )}
      {!capability.availability.save && (
        <p role="status" className="text-secondary">
          {t`Creating and saving workflows is unavailable from this host. You can browse saved configurations, but cannot save changes here yet.`}
        </p>
      )}
      {draft &&
        snapshot.status !== "unavailable" &&
        snapshot.status !== "idle" && (
          <WorkflowEditor
            key={draft.editorKey}
            create={!draft.original}
            yaml={draft.yaml}
            initialYaml={draft.original?.yaml}
            onChange={(yaml) => setDraft({ ...draft, yaml })}
            onSave={save}
            onLocalDraftRiskChange={setLocalDraftAtRisk}
            readOnly={readonly}
            busy={busy}
            locked={!!draft.operationId}
            blocked={blocked}
            enableBlocked={
              channel.archived ? i18n._(ARCHIVED_REASON) : undefined
            }
            onCancel={() => select("close")}
            scope={
              <span className="workflow-channel-label text-label">
                <ChannelIcon size={18} aria-hidden="true" />
                {channel.name}
              </span>
            }
            run={
              !readonly && (
                <IconButton
                  aria-label={t`Run now`}
                  title={
                    channel.archived ? i18n._(ARCHIVED_REASON) : t`Run now`
                  }
                  aria-describedby={
                    channel.archived ? archivedReasonId : undefined
                  }
                  disabled={
                    channel.archived ||
                    dirty ||
                    !!draft.operationId ||
                    unresolvedWrite ||
                    !capability.availability.trigger
                  }
                  // A natively disabled button gets no hover, so its reason would never show.
                  focusableWhenDisabled={channel.archived}
                  icon={<PlayIcon size={20} aria-hidden="true" />}
                  onClick={trigger}
                />
              )
            }
            actions={
              draft.original && (
                <>
                  <MenuItem
                    tone="danger"
                    aria-describedby={!canDelete ? deleteReasonId : undefined}
                    disabled={
                      !canDelete ||
                      !!draft.operationId ||
                      unresolvedWrite ||
                      !capability.availability.delete
                    }
                    onClick={() => setConfirmDelete(true)}
                  >
                    <MenuIcon>
                      <TrashIcon size={14} />
                    </MenuIcon>
                    {t`Delete workflow`}
                  </MenuItem>
                  {!canDelete && (
                    <MenuNote id={deleteReasonId}>
                      {t`Only the author or their verified agent owner can delete this workflow.`}
                    </MenuNote>
                  )}
                </>
              )
            }
            runs={
              draft.original &&
              capability.availability.history && (
                <WorkflowRuns
                  key={`${draft.original.owner}:${draft.original.id}:${createdRun ?? ""}`}
                  capability={capability}
                  workflow={draft.original}
                  heading={false}
                />
              )
            }
            status={
              <>
                {channel.archived && (
                  <span id={archivedReasonId} hidden>
                    {i18n._(ARCHIVED_REASON)}
                  </span>
                )}
                {(snapshot.status === "error" ||
                  snapshot.status === "loading") && (
                  <div className="workflow-options">
                    {snapshot.status === "error" ? (
                      <p role="alert" className="text-danger">
                        {snapshot.error ??
                          t`Configurations could not be read. Refresh to retry.`}
                      </p>
                    ) : (
                      <p role="status">{t`Reading configurations…`}</p>
                    )}
                    <Button
                      disabled={snapshot.status === "loading"}
                      onClick={() => void refresh()}
                    >
                      {t`Refresh configurations`}
                    </Button>
                  </div>
                )}
                {!capability.availability.delete && (
                  <p className="text-body-sm text-secondary">
                    {t`You can't delete workflows here.`}
                  </p>
                )}
                {error && (
                  <p role="alert" className="text-danger">
                    {error}
                  </p>
                )}
                {runOperation?.outcome === "succeeded" && (
                  <p role="status" className="text-body-sm text-secondary">
                    {i18n._(messages.trigger.succeeded)}
                  </p>
                )}
                {operation?.outcome === "rejected" && (
                  <Button
                    onClick={() => {
                      submission.current = null;
                      const { operationId: _, ...rest } = draft;
                      setDraft(rest);
                    }}
                  >
                    {t`Continue editing retained draft`}
                  </Button>
                )}
                <WorkflowOperations
                  operations={ownOperations.filter(
                    (item) =>
                      item.action === "save" ||
                      (item.action === "trigger" &&
                        (item.outcome === "unknown" ||
                          item.outcome === "rejected")),
                  )}
                  snapshot={snapshot}
                  onCheckSaved={refresh}
                  onReviewSaved={select}
                  onDismiss={dismiss}
                />
              </>
            }
            details={
              <>
                <p className="text-body-sm text-subtle">
                  {t`Unsaved changes stay in this editor. Leaving or reloading discards them without cancelling submitted operations.`}
                </p>
                {draft.original && (
                  <details>
                    <summary>{t`Configuration details`}</summary>
                    <p className="text-mono-sm workflow-key">
                      {t`Owner:`} {draft.original.owner}
                    </p>
                    <p className="text-mono-sm workflow-key">
                      {t`Revision:`} {draft.original.revision}
                    </p>
                  </details>
                )}
              </>
            }
          >
            {pendingSelection && (
              <ConfirmAction
                title={t`Leave this draft?`}
                description={t`Unsaved draft changes will be discarded. Any submitted operation stays with the captured community session; leaving does not cancel or repeat it.`}
                action={t`Leave draft`}
                destructive
                onConfirm={() => open(pendingSelection)}
                onCancel={() => setPendingSelection(null)}
              />
            )}
            {confirmDelete && (
              <ConfirmAction
                title={t`Delete this workflow?`}
                description={t`The saved workflow may remain visible. Work already running may continue.`}
                action={t`Delete workflow`}
                cancel={t`Cancel`}
                destructive
                error={error}
                onConfirm={remove}
                onCancel={() => setConfirmDelete(false)}
              />
            )}
          </WorkflowEditor>
        )}
      {!draft && (
        <WorkflowOperations
          operations={ownOperations.filter((item) => item.action !== "delete")}
          snapshot={snapshot}
          onCheckSaved={refresh}
          onReviewSaved={select}
          onDismiss={dismiss}
        />
      )}
    </section>
  );
}
