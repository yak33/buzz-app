import { useLingui } from "@lingui/react/macro";
import { useRef } from "react";
import { AlertDialog } from "../../shared/design-system/ui/AlertDialog";
import { Button } from "../../shared/design-system/ui/Button";

export function ConfirmAction({
  title,
  description,
  action,
  cancel,
  onConfirm,
  onCancel,
  pending = false,
  destructive = false,
  error,
}: {
  title: string;
  description: string;
  action: string;
  cancel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
  destructive?: boolean;
  error?: string | null;
}) {
  const { t } = useLingui();
  const cancelLabel = cancel ?? t`Keep editing`;
  const cancelAction = useRef<HTMLButtonElement>(null);
  const confirmAction = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog
      title={title}
      initialFocus={destructive ? cancelAction : confirmAction}
      description={description}
      pending={pending}
      onClose={onCancel}
      actions={
        <>
          <Button ref={cancelAction} disabled={pending} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmAction}
            variant={destructive ? "destructive" : "prominent"}
            disabled={pending}
            onClick={onConfirm}
          >
            {action}
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </AlertDialog>
  );
}
