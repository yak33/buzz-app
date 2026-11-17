import { useRef, useState } from "react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import type { PluginInfo } from "../plugins/types";
import type { PluginManager } from "../plugins/manager";
import { DotsThreeIcon } from "../shared/design-system/icons";
import {
  MenuRoot,
  MenuTrigger,
  MenuPopup,
  MenuItem,
  MenuCheckboxItem,
} from "../shared/design-system/ui/Menu";
import { IconButton } from "../shared/design-system/ui/IconButton";
import { Button } from "../shared/design-system/ui/Button";
import { AlertDialog } from "../shared/design-system/ui/AlertDialog";
import { Dialog } from "../shared/design-system/ui/Dialog";
import { PluginAccessReview } from "./PluginAccessReview";

export function PluginMenu({
  plugin,
  plugins,
  busy,
  label,
  toggle,
  onRemoved,
  openUpdateSettings = false,
}: {
  plugin: PluginInfo;
  plugins: PluginManager;
  busy: boolean;
  label?: string;
  onRemoved?: () => void;
  toggle?: { label: string; disabled: boolean; run(): void };
  openUpdateSettings?: boolean;
}) {
  const { i18n, t } = useLingui();
  const triggerLabel = label ?? i18n._(msg`More plugin actions`);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const rollBack = useRef<HTMLButtonElement>(null);
  const updateChoice = useRef<HTMLDivElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmRollback, setConfirmRollback] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackError, setRollbackError] = useState<string | null>(null);
  const [showAccess, setShowAccess] = useState(false);
  if (plugin.source !== "external") return null;
  return (
    <>
      <MenuRoot
        defaultOpen={openUpdateSettings}
        onOpenChangeComplete={(open) => {
          if (open && openUpdateSettings) updateChoice.current?.focus();
        }}
      >
        <MenuTrigger
          render={
            <IconButton
              ref={deleteTrigger}
              aria-label={triggerLabel}
              size="sm"
              disabled={busy}
              icon={<DotsThreeIcon size={16} aria-hidden="true" />}
            />
          }
        />
        <MenuPopup
          align="end"
          aria-label={t`Plugin actions`}
          finalFocus={
            confirmDelete || confirmRollback || showAccess
              ? false
              : deleteTrigger
          }
        >
          <MenuItem onClick={() => setShowAccess(true)}>
            {t`Review access`}
          </MenuItem>
          {plugin.manifest.updates &&
            plugin.updateSource &&
            "repository" in plugin.updateSource && (
              <MenuCheckboxItem
                ref={updateChoice}
                checked={
                  plugin.updateChecks ?? plugin.manifest.updates.defaultEnabled
                }
                disabled={busy}
                onCheckedChange={(checked) =>
                  void plugins.change(
                    checked ? "enable-update-checks" : "disable-update-checks",
                    plugin.manifest.id,
                  )
                }
              >
                {t`Check for updates automatically`}
              </MenuCheckboxItem>
            )}
          {toggle && (
            <MenuItem disabled={toggle.disabled} onClick={toggle.run}>
              {toggle.label}
            </MenuItem>
          )}
          {plugin.source === "external" && plugin.previous && (
            <MenuItem
              disabled={busy || !!plugin.rollbackBlockedReason}
              onClick={() => {
                setRollbackError(null);
                setConfirmRollback(true);
              }}
            >
              {t`Roll back`}
            </MenuItem>
          )}
          {plugin.source === "external" && (
            <MenuItem
              tone="danger"
              disabled={busy}
              onClick={() => {
                setDeleteError(null);
                setConfirmDelete(true);
              }}
            >
              {t`Delete`}
            </MenuItem>
          )}
        </MenuPopup>
      </MenuRoot>
      <Dialog
        open={showAccess}
        onOpenChange={setShowAccess}
        title={t`What this plugin can do`}
        finalFocus={deleteTrigger}
        actions={
          <Button onClick={() => setShowAccess(false)}>{t`Done`}</Button>
        }
      >
        <PluginAccessReview manifest={plugin.manifest} />
      </Dialog>
      {confirmRollback && (
        <AlertDialog
          title={t`Roll back ${plugin.manifest.name}?`}
          description={t`Restore the previous installed version. You can update again from the source folder or repository.`}
          pending={busy || rollingBack}
          initialFocus={rollBack}
          finalFocus={deleteTrigger}
          onClose={() => setConfirmRollback(false)}
          actions={
            <>
              <Button
                disabled={busy || rollingBack}
                onClick={() => setConfirmRollback(false)}
              >
                {t`Cancel`}
              </Button>
              <Button
                ref={rollBack}
                variant="prominent"
                disabled={
                  busy ||
                  rollingBack ||
                  !plugin.previous ||
                  !!plugin.rollbackBlockedReason
                }
                onClick={async () => {
                  if (
                    busy ||
                    rollingBack ||
                    !plugin.previous ||
                    plugin.rollbackBlockedReason
                  )
                    return;
                  setRollingBack(true);
                  setRollbackError(null);
                  try {
                    if (await plugins.change("rollback", plugin.manifest.id))
                      setConfirmRollback(false);
                    else
                      setRollbackError(
                        plugins.snapshot().error ??
                          i18n._(
                            msg`Plugin rollback wasn’t confirmed. Try again.`,
                          ),
                      );
                  } finally {
                    setRollingBack(false);
                  }
                }}
              >
                {t`Roll back`}
              </Button>
            </>
          }
        >
          {rollbackError && (
            <p role="alert" className="error text-body-sm">
              {rollbackError}
            </p>
          )}
        </AlertDialog>
      )}
      {confirmDelete && (
        <AlertDialog
          title={t`Delete ${plugin.manifest.name}?`}
          description={t`Removes this plugin and its rollback history from Buzz. You can install it again later.`}
          pending={busy || deleting}
          finalFocus={deleteTrigger}
          initialFocus={cancelDelete}
          onClose={() => setConfirmDelete(false)}
          actions={
            <>
              <Button
                ref={cancelDelete}
                disabled={busy || deleting}
                onClick={() => setConfirmDelete(false)}
              >
                {t`Cancel`}
              </Button>
              <Button
                variant="destructive"
                disabled={busy || deleting}
                onClick={async () => {
                  if (busy || deleting) return;
                  setDeleting(true);
                  setDeleteError(null);
                  try {
                    if (await plugins.change("remove", plugin.manifest.id)) {
                      setConfirmDelete(false);
                      onRemoved?.();
                    } else
                      setDeleteError(
                        plugins.snapshot().error ??
                          i18n._(
                            msg`Plugin deletion wasn’t confirmed. Try again.`,
                          ),
                      );
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {t`Delete plugin`}
              </Button>
            </>
          }
        >
          {deleteError && (
            <p role="alert" className="error text-body-sm">
              {deleteError}
            </p>
          )}
        </AlertDialog>
      )}
    </>
  );
}
