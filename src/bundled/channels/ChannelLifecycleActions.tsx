import { useLingui } from "@lingui/react/macro";
import type { ChannelSummary } from "../../features/relay/contracts";
import type { ChannelLifecycleAction } from "../../features/relay/channel-lifecycle-protocol";
import { Button } from "../../shared/design-system/ui/Button";
import {
  ArchiveIcon,
  SignOutIcon,
  TrashIcon,
} from "../../shared/design-system/icons";
import type { LifecycleNoun } from "./ChannelLifecycleDialog";
import { useLifecycleOffer, type LifecycleSession } from "./useLifecycleOffer";

/** Settings offers live-state actions; the sidebar owns confirmation. */
export function ChannelLifecycleActions({
  channel,
  session,
  choose,
  noun = "channel",
}: {
  channel: ChannelSummary;
  session: LifecycleSession;
  choose(action: ChannelLifecycleAction, trigger: HTMLElement): void;
  noun?: LifecycleNoun;
}) {
  const { t } = useLingui();
  const permissions = useLifecycleOffer(session, channel);
  // The noun is interpolated into full templates so translations can reorder it.
  const nounText = noun === "chat" ? t`chat` : t`channel`;
  if (!session.channelLifecycle.available)
    return <p>{t`Channel actions unavailable on this connection`}</p>;
  return (
    <>
      {permissions?.canLeave && (
        <Button onClick={(event) => choose("leave", event.currentTarget)}>
          <SignOutIcon size={16} aria-hidden="true" />
          {t`Leave ${nounText}`}
        </Button>
      )}
      {(permissions?.canArchive || permissions?.canUnarchive) && (
        <Button
          onClick={(event) =>
            choose(
              permissions.canUnarchive ? "unarchive" : "archive",
              event.currentTarget,
            )
          }
        >
          <ArchiveIcon size={16} aria-hidden="true" />
          {permissions.canUnarchive ? (
            t`Unarchive ${nounText}`
          ) : (
            t`Archive ${nounText}`
          )}
        </Button>
      )}
      {permissions?.canDelete && (
        <Button
          variant="destructive"
          onClick={(event) => choose("delete", event.currentTarget)}
        >
          <TrashIcon size={16} aria-hidden="true" />
          {t`Delete ${nounText}`}
        </Button>
      )}
    </>
  );
}
