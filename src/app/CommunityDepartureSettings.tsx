import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import {
  communityActionLabel,
  communityDefaultName,
} from "../features/communities/names";
import { communityDestination } from "../features/communities/destination";
import type { Communities, Membership } from "../features/communities/service";
import {
  CommunityDepartureError,
  deviceRemovalFailureText,
  leaveCleanupFailureText,
  leaveCommunity,
  leaveCommunityFailureText,
  leftCommunityText,
  removeCommunityFromDevice,
  removedFromDeviceText,
} from "../features/communities/departure";
import { AlertDialog } from "../shared/design-system/ui/AlertDialog";
import { Button } from "../shared/design-system/ui/Button";
import { Header } from "../shared/design-system/ui/Header";
import { PreferenceRow } from "../shared/design-system/ui/PreferenceRow";
import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { useToastNotification } from "../shared/design-system/ui/Toast";

type Intent = "remove" | "leave";

export function CommunityDepartureSettings({
  communities,
  community,
  onRemoved,
  onPending,
}: {
  communities: Communities;
  community: Membership;
  onRemoved(): void;
  onPending?: (pending: boolean) => void;
}) {
  const { t } = useLingui();
  const notify = useToastNotification();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(false);
  const completed = useRef(false);
  const removeButton = useRef<HTMLButtonElement>(null);
  const leaveButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = async () => {
    if (!intent || busy.current) return;
    const viewer = communities.snapshot().viewer;
    busy.current = true;
    setPending(true);
    onPending?.(true);
    try {
      if (intent === "leave") {
        const result = await leaveCommunity(communities, community);
        // Removing the selected community can unmount this page before cleanup
        // finishes. Its result still belongs in the host toast, not a new form.
        if (communities.snapshot().viewer === viewer)
          notify(
            leftCommunityText(
              communityActionLabel(community),
              result.outcome,
              result.residue.length > 0,
            ),
            result.outcome === "left" ? "success" : "info",
          );
      } else {
        const result = await removeCommunityFromDevice(communities, community);
        if (communities.snapshot().viewer === viewer)
          notify(
            removedFromDeviceText(
              communityActionLabel(community),
              result.residue.length > 0,
            ),
            "success",
          );
      }
      if (mounted.current && communities.snapshot().viewer === viewer) {
        completed.current = true;
        setIntent(null);
        onRemoved();
      }
    } catch (error) {
      if (communities.snapshot().viewer !== viewer) return;
      const departure =
        error instanceof CommunityDepartureError ? error : undefined;
      notify(
        intent === "remove"
          ? deviceRemovalFailureText(
              communityActionLabel(community),
              departure?.reason ?? error,
            )
          : departure?.phase === "device"
            ? leaveCleanupFailureText(
                communityActionLabel(community),
                departure.reason,
                departure.outcome,
              )
            : leaveCommunityFailureText(
                communityActionLabel(community),
                departure?.reason ?? error,
              ),
        "error",
      );
      if (mounted.current) setIntent(null);
    } finally {
      busy.current = false;
      if (mounted.current) {
        setPending(false);
        onPending?.(false);
      }
    }
  };
  return (
    <section aria-labelledby="leave-community-title">
      <Header
        id="leave-community-title"
        title={t`Leave or remove`}
        subtitle={t`Remove community from Buzz on this device or leave community completely.`}
      />
      <SettingsGroup>
        <PreferenceRow
          title={t`Remove from this device`}
          subtitle={t`Removes community connection and data from Buzz on this device only. Your membership won't change.`}
          trailing={
            <Button
              ref={removeButton}
              type="button"
              disabled={pending}
              onClick={() => setIntent("remove")}
            >
              {t`Remove from this device`}
            </Button>
          }
        />
        <PreferenceRow
          title={t`Leave community`}
          subtitle={t`Ends your membership and removes community from this device. Rejoining may require a new invite.`}
          trailing={
            <Button
              ref={leaveButton}
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => setIntent("leave")}
            >
              {t`Leave community`}
            </Button>
          }
        />
      </SettingsGroup>
      {intent && (
        <AlertDialog
          title={
            intent === "leave"
              ? t`Leave ${communityDefaultName(community)}?`
              : t`Remove ${communityDefaultName(community)} from this device?`
          }
          description={
            intent === "leave"
              ? t`This will send a leave request to the community’s relay and remove it from this device. You may need a new invite to rejoin.`
              : t`The community connection and any saved drafts or data will be removed from Buzz on this device.`
          }
          pending={pending}
          finalFocus={() =>
            completed.current
              ? false
              : intent === "leave"
                ? leaveButton.current
                : removeButton.current
          }
          onClose={() => setIntent(null)}
          actions={
            <>
              <Button disabled={pending} onClick={() => setIntent(null)}>
                {t`Cancel`}
              </Button>
              <Button
                variant={intent === "leave" ? "destructive" : "prominent"}
                loading={pending}
                onClick={() => void run()}
              >
                {intent === "leave"
                  ? t`Leave community`
                  : t`Remove from this device`}
              </Button>
            </>
          }
        >
          <div className="min-w-0 space-y-2 text-body-sm">
            {community.localName &&
              community.localName !== communityDefaultName(community) && (
                <p className="text-muted">
                  {t`Shown as ${community.localName} on this device`}
                </p>
              )}
            <p className="break-all">
              {communityDestination(community.id).url}
            </p>
          </div>
        </AlertDialog>
      )}
    </section>
  );
}
