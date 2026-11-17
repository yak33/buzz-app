import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { Button } from "../../shared/design-system/ui/Button";
import type {
  WorkflowDefinition,
  WorkflowDefinitions,
  WorkflowOperation,
  WorkflowView,
} from "../../features/workflows/types";
import { ConfirmAction } from "./ConfirmAction";
import { confirmedDeletion, deletionStatus } from "./editor-model";

export const messages = {
  save: {
    pending: msg`Saving configuration…`,
    succeeded: msg`Configuration saved.`,
    rejected: msg`Configuration was not saved.`,
    unknown: msg`Save response was lost. Check the saved configuration before trying again.`,
  },
  trigger: {
    pending: msg`Requesting a run…`,
    succeeded: msg`Run requested. Inspect run history for its result.`,
    rejected: msg`Failed to trigger workflow`,
    unknown: msg`The run may have started, but its response was lost. Checking configuration or dismissing this notice cannot confirm a run.`,
  },
} as const;

export function WorkflowOperations({
  operations,
  snapshot,
  onCheckSaved,
  onReviewSaved,
  onDismiss,
}: {
  operations: readonly WorkflowOperation[];
  snapshot: ReturnType<WorkflowView<WorkflowDefinitions>["snapshot"]>;
  onCheckSaved: () => Promise<void>;
  onReviewSaved: (definition: WorkflowDefinition) => void;
  onDismiss: (eventId: string) => Promise<void>;
}) {
  const { i18n, t } = useLingui();
  const [error, setError] = useState<string | null>(null);
  const [acknowledge, setAcknowledge] = useState<WorkflowOperation | null>(
    null,
  );
  const [working, setWorking] = useState(false);
  const perform = async (action: () => Promise<void>) => {
    setWorking(true);
    try {
      await action();
      setError(null);
      setAcknowledge(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : i18n._(msg`The request could not be completed. Try again.`),
      );
    } finally {
      setWorking(false);
    }
  };
  if (!operations.length && !acknowledge) return null;
  return (
    <section aria-label={t`Workflow operations`} className="workflow-operations">
      <h3 className="text-heading">{t`Recent activity`}</h3>
      {error && !acknowledge && <p role="alert">{error}</p>}
      {operations.map((operation) => {
        const current = (
          snapshot.status === "ready" ? snapshot.data.items : []
        ).find(
          (definition) =>
            definition.id === operation.workflow.id &&
            definition.owner === operation.workflow.owner &&
            definition.channelId === operation.workflow.channelId,
        );
        return (
          <div key={operation.eventId}>
            <p role="status">
              {operation.action === "delete"
                ? deletionStatus(operation, snapshot)
                : i18n._(messages[operation.action][operation.outcome])}
            </p>
            {operation.action === "trigger" &&
            operation.outcome === "rejected" ? (
              <p className="text-danger">
                {operation.error || t`The relay did not create a workflow run.`}
              </p>
            ) : (
              operation.action !== "delete" &&
              operation.error && (
                <p className="text-danger">{operation.error}</p>
              )
            )}
            <div className="workflow-toolbar">
              {(operation.action === "save" || operation.action === "delete") &&
                (operation.outcome === "unknown" ||
                  operation.outcome === "succeeded") &&
                !confirmedDeletion(operation, snapshot) && (
                  <>
                    <Button
                      size="compact"
                      disabled={working || snapshot.status === "loading"}
                      onClick={() => void perform(onCheckSaved)}
                    >
                      {t`Check saved configuration`}
                    </Button>
                    {current && current.revision !== operation.eventId && (
                      <Button
                        size="compact"
                        disabled={working}
                        onClick={() => onReviewSaved(current)}
                      >
                        {t`Review current configuration`}
                      </Button>
                    )}
                  </>
                )}
              {operation.outcome !== "pending" && (
                <Button
                  size="compact"
                  disabled={working}
                  onClick={() => setAcknowledge(operation)}
                >
                  {t`Dismiss notice`}
                </Button>
              )}
            </div>
            <details>
              <summary>{t`Delivery details`}</summary>
              {operation.action === "delete" && operation.error && (
                <p className="text-danger">{operation.error}</p>
              )}
              <p className="text-body-sm">
                {operation.action}: {operation.outcome} · {t`delivery`}{" "}
                {operation.delivery}
              </p>
              <p className="text-mono-sm workflow-key">
                {t`Event ID:`} {operation.eventId}
              </p>
              {operation.runId && (
                <p className="text-mono-sm workflow-key">
                  {t`Returned run ID:`} {operation.runId}
                </p>
              )}
            </details>
          </div>
        );
      })}
      {acknowledge && (
        <ConfirmAction
          title={t`Dismiss this notice?`}
          pending={working}
          error={error}
          description={
            acknowledge.action === "delete"
              ? t`Your draft is kept and editing is unlocked. Dismissing this notice does not confirm, cancel, or repeat deletion. Check saved configuration before deleting again.`
              : t`Dismissal only clears this notice and its editor lock. It does not undo, cancel, or repeat a command, or confirm its outcome. Review the saved configuration before saving again; a new run request may run the workflow again. Your unsaved draft is kept.`
          }
          action={
            working ? t`Dismissing…` : t`Dismiss notice and continue`
          }
          onConfirm={() => {
            if (!working) void perform(() => onDismiss(acknowledge.eventId));
          }}
          onCancel={() => {
            if (!working) setAcknowledge(null);
          }}
        />
      )}
    </section>
  );
}
