import { useLingui } from "@lingui/react/macro";
import type { ReactNode } from "react";
import { AvatarStack } from "../../shared/design-system/ui/AvatarStack";
import { PencilSimpleIcon } from "../../shared/design-system/icons/index";
import type { Profile } from "../relay/contracts";
import styles from "./Messages.module.css";
import { avatarMedia } from "../../shared/avatar-source";

/** Shared summary contents for channel threads and collapsed reply branches. */
export function ReplySummary({
  count,
  participants,
  profiles,
  agentPubkeys,
  resolveName,
  media,
  unreadLabel,
  unreadCount,
  workingParticipants = [],
  activity,
  hideEmptyLabel = false,
  draft = false,
  replied = count > 0,
}: {
  workingParticipants?: readonly string[];
  activity?: ReactNode;
  /** Activity-only triggers already have an accessible thread action label. */
  hideEmptyLabel?: boolean;
  /** An unsent reply waits in this thread; it names an empty thread itself. */
  draft?: boolean;
  /** The thread has replies, even when an activity line hides their count. */
  replied?: boolean;
  count: number;
  participants: readonly string[];
  profiles?: ReadonlyMap<string, Profile> | undefined;
  agentPubkeys?: ReadonlySet<string> | undefined;
  resolveName(id: string, fallback: string): string;
  media(url: string, size?: "small"): string | undefined;
  unreadLabel?: string | undefined;
  unreadCount?: number;
}) {
  const { t } = useLingui();
  // reply/replies 先求值成局部变量，再插值进同一条消息（t`` 内不能嵌套 t``）。
  const replyWord = count === 1 ? t`reply` : t`replies`;
  const replyCountLabel = t`${count} ${replyWord}`;
  return (
    <>
      <AvatarStack
        size="small"
        items={[...new Set(participants)]
          .filter((id) => !workingParticipants.includes(id))
          .map((id) => {
            const profile = profiles?.get(id);
            return {
              id,
              name: resolveName(id, profile?.name ?? id.slice(0, 10)),
              src: avatarMedia(profile?.picture, media),
              shape: agentPubkeys?.has(id) ? "squircle" : "circle",
            };
          })}
      />
      {activity}
      {(count > 0 || !(hideEmptyLabel || draft)) && (
        <span>{count > 0 ? replyCountLabel : t`View thread`}</span>
      )}
      {unreadCount ? (
        <span>{t`(${unreadCount} new)`}</span>
      ) : unreadLabel ? (
        <span
          className={styles.threadUnread}
          aria-hidden="true"
          title={unreadLabel}
        />
      ) : null}
      {draft && (
        <span className={styles.threadDraft} data-thread-draft="">
          {replied && <span aria-hidden="true">·</span>}
          <PencilSimpleIcon size={14} aria-hidden="true" />
          {replied ? t`Draft` : t`Draft reply`}
        </span>
      )}
    </>
  );
}
