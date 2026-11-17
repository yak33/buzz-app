import { msg } from "@lingui/core/macro";
import type { I18n } from "@lingui/core";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "../../shared/design-system/ui/Button";
import {
  ChannelLifecycleUnconfirmed,
  type ChannelLifecycleCapability,
} from "../../features/relay/channel-lifecycle";
import type { ChannelLifecycleAction } from "../../features/relay/channel-lifecycle-protocol";
import { ApiPaused } from "../../features/relay/http-admission";
import { Dialog, type DialogProps } from "../../shared/design-system/ui/Dialog";
import {
  ToastNotice,
  useToastNotification,
} from "../../shared/design-system/ui/Toast";

export type LifecycleNoun = "channel" | "chat";

/** Solo chats are channels on the relay; people should read them as chats. */
export const lifecycleNoun = (
  channel: Readonly<{ channelType?: string | undefined }> | undefined,
): LifecycleNoun => (channel?.channelType === "solo" ? "chat" : "channel");

const details = {
  channel: {
    archive:
      msg`Archive this channel for everyone and remove it from the sidebar. Messages are kept. Find it in search to unarchive it later.`,
    unarchive:
      msg`Unarchive this channel for everyone and return it to the sidebar. Members can send messages again.`,
    delete: msg`This deletes the channel for everyone. You can’t undo this.`,
    leave: msg`Leave this channel and remove it from your sidebar. You may need an invitation to rejoin a private channel.`,
  },
  chat: {
    archive:
      msg`Archive this chat for everyone in it and remove it from the sidebar. Messages are kept. Find it in search to unarchive it later.`,
    unarchive:
      msg`Unarchive this chat and return it to the sidebar. Messages can be sent again.`,
    delete: msg`This deletes the chat for everyone in it. You can’t undo this.`,
    leave: msg`Leave this chat and remove it from your sidebar. You may need an invitation to rejoin.`,
  },
} as const;

/** The noun is interpolated as an already-translated value, so each sentence
 * stays one complete template and translations can reorder it. */
function copyFor(i18n: I18n, action: ChannelLifecycleAction, noun: LifecycleNoun) {
  if (action === "hide")
    return {
      pending: i18n._(msg`Hiding conversation…`),
      done: i18n._(msg`Conversation hidden`),
      title: i18n._(msg`Hide conversation`),
      detail: i18n._(
        msg`Hide this conversation from your sidebar only. Messages and membership are kept; other participants are not removed.`,
      ),
    };
  const nounText = i18n._(noun === "chat" ? msg`chat` : msg`channel`);
  const nounTitle = i18n._(noun === "chat" ? msg`Chat` : msg`Channel`);
  switch (action) {
    case "archive":
      return {
        pending: i18n._(msg`Archiving ${nounText}…`),
        done: i18n._(msg`${nounTitle} archived`),
        title: i18n._(msg`Archive ${nounText}`),
        detail: i18n._(details[noun].archive),
      };
    case "unarchive":
      return {
        pending: i18n._(msg`Unarchiving ${nounText}…`),
        done: i18n._(msg`${nounTitle} unarchived`),
        title: i18n._(msg`Unarchive ${nounText}`),
        detail: i18n._(details[noun].unarchive),
      };
    case "delete":
      return {
        pending: i18n._(msg`Deleting ${nounText}…`),
        done: i18n._(msg`${nounTitle} deleted`),
        title: i18n._(msg`Delete ${nounText}`),
        detail: i18n._(details[noun].delete),
      };
    case "leave":
      return {
        pending: i18n._(msg`Leaving ${nounText}…`),
        done: i18n._(msg`${nounTitle} left`),
        title: i18n._(msg`Leave ${nounText}`),
        detail: i18n._(details[noun].leave),
      };
  }
}

// Enter confirms unarchive and hide. Archive affects everyone, so it starts on
// Cancel while retaining the action's prominent treatment.
const reversible = new Set<ChannelLifecycleAction>(["unarchive", "hide"]);

/** Singular and plural are separate complete templates. */
function wait(i18n: I18n, milliseconds: number) {
  const seconds = Math.ceil(milliseconds / 1000);
  if (seconds < 60)
    return (
      seconds === 1 ? i18n._(msg`1 second`) : i18n._(msg`${seconds} seconds`)
    );
  const minutes = Math.ceil(seconds / 60);
  return (
    minutes === 1 ? i18n._(msg`1 minute`) : i18n._(msg`${minutes} minutes`)
  );
}

export function ChannelLifecycleDialog({
  channelId,
  channelName,
  noun = "channel",
  action,
  lifecycle,
  close,
  completed,
  onSubmit,
  failed,
  finalFocus,
  confirmed = false,
  undo,
  autoJoin = false,
}: {
  channelId: string;
  channelName: string;
  noun?: LifecycleNoun;
  action: ChannelLifecycleAction;
  lifecycle: ChannelLifecycleCapability;
  close(): void;
  completed(): void;
  onSubmit?(): void;
  finalFocus?: DialogProps["finalFocus"];
  /** `unconfirmed`: the relay may have applied it anyway
   * (`ChannelLifecycleUnconfirmed`). */
  failed?(title: string, message: string, unconfirmed: boolean): void;
  /** Already chosen without a dialog, as Undo is: run it on mount. */
  confirmed?: boolean;
  /** Offered from an immediate archive's result toast. */
  undo?(): void;
  /** A starter channel: the relay keeps the flag while archived. */
  autoJoin?: boolean;
}) {
  const { i18n, t } = useLingui();
  const callbacks = useRef({ completed, failed });
  useLayoutEffect(() => {
    callbacks.current = { completed, failed };
  });
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const confirms = reversible.has(action);
  const copy = copyFor(i18n, action, noun);
  // The switch is hidden while archived, and Unarchive applies the flag again.
  const description =
    action === "archive" && autoJoin
      ? t`${copy.detail} It’s a starter channel, so new members will be added to it again once it’s unarchived. To stop that, turn off Starter channel for new members in Settings first.`
      : copy.detail;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // A paused delete keeps its confirmation, with Retry once the pause ends.
  const [pausedUntil, setPausedUntil] = useState<number>();
  const [now, setNow] = useState(0);
  const cooldown =
    pausedUntil === undefined ? 0 : Math.max(0, pausedUntil - now);
  useEffect(() => {
    if (pausedUntil === undefined || !cooldown) return;
    // Tick on whole-second boundaries, measured from the admission lane's
    // monotonic clock rather than this render, so a late tick stays exact.
    // Whole-millisecond delays let a coarse clock advance, so each tick re-renders.
    const left = pausedUntil - performance.now();
    const timer = setTimeout(
      () => setNow(performance.now()),
      left > 0 ? Math.ceil(left % 1000) || 1000 : 0,
    );
    return () => clearTimeout(timer);
  }, [pausedUntil, cooldown]);
  const notify = useToastNotification();
  const operation = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    return () => {
      operation.current?.abort();
    };
  }, []);
  // Archiving a chat is undoable from its result toast, so it skips
  // confirmation; channels archive for everyone and still confirm. Undo was
  // chosen from that toast, so it runs at once too.
  // Deferring the start lets a development StrictMode remount cancel it.
  const immediate = confirmed || (action === "archive" && noun === "chat");
  // biome-ignore lint/correctness/useExhaustiveDependencies: start once per mounted archive request.
  useEffect(() => {
    if (!immediate) return;
    const timer = setTimeout(() => void submit());
    return () => clearTimeout(timer);
  }, []);
  // Without a confirmation to dismiss, a fast archive needs no progress
  // feedback: the result toast follows. Announce only a slow write.
  const [slow, setSlow] = useState(!immediate);
  useEffect(() => {
    if (!immediate || !busy) return;
    const timer = setTimeout(() => setSlow(true), 1000);
    return () => clearTimeout(timer);
  }, [immediate, busy]);
  const submit = async () => {
    if (operation.current || error || cooldown) return;
    const controller = new AbortController();
    operation.current = controller;
    onSubmit?.();
    setBusy(true);
    setError("");
    setPausedUntil(undefined);
    try {
      await lifecycle.run(action, channelId, controller.signal);
      if (!controller.signal.aborted) {
        notify(
          i18n._(msg`${copy.done}: ${channelName}`),
          "success",
          immediate && action === "archive" && undo
            ? {
                label: i18n._(msg`Undo`),
                onClick: undo,
                timeout: 3000,
              }
            : undefined,
        );
        callbacks.current.completed();
      }
    } catch (error) {
      if (
        !controller.signal.aborted &&
        action === "delete" &&
        !immediate &&
        error instanceof ApiPaused
      ) {
        // Admission refused it before sending, and `run` wraps anything after
        // publication, so a bare pause proves nothing was sent.
        const at = performance.now();
        setNow(at);
        setPausedUntil(at + (error.retryAfterMs ?? 0));
      } else if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : String(error);
        if (callbacks.current.failed)
          callbacks.current.failed(
            i18n._(msg`${copy.title} failed`),
            message,
            error instanceof ChannelLifecycleUnconfirmed,
          );
        else setError(message);
      }
    } finally {
      operation.current = undefined;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  // Keep the owner mounted while closing the modal, so shared focus restoration
  // runs and the caller's duplicate gate remains held until the result settles.
  return (
    <>
      {((busy && slow) || error) && (
        <ToastNotice
          title={busy ? copy.pending : t`${copy.title} failed`}
          description={busy ? channelName : error}
          tone={busy ? "info" : "error"}
          {...(!busy && { onDismiss: close })}
        />
      )}
      <Dialog
        size="compact"
        open={!immediate && !busy && !error}
        dismissOnOutsideClick
        initialFocus={confirms ? confirm : cancel}
        // Cancellation remains sidebar-owned; submission returns to the trigger.
        finalFocus={busy || error ? finalFocus : false}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={
          action === "delete"
            ? t`Delete ${channelName}?`
            : t`${copy.title}: ${channelName}`
        }
        description={
          pausedUntil === undefined
            ? description
            : cooldown
              ? t`${description} Relay requests are paused, so nothing was deleted. You can retry in ${wait(i18n, cooldown)}.`
              : t`${description} Relay requests were paused, so nothing was deleted. You can retry now.`
        }
        actions={
          <>
            <Button ref={cancel} type="button" onClick={close}>
              {t`Cancel`}
            </Button>
            <Button
              type="button"
              ref={confirm}
              variant={
                action === "delete"
                  ? "destructive"
                  : action === "archive" || confirms
                    ? "prominent"
                    : "subtle"
              }
              disabled={cooldown > 0}
              focusableWhenDisabled
              onClick={() => void submit()}
            >
              {pausedUntil === undefined ? copy.title : t`Retry`}
            </Button>
          </>
        }
      >
        {null}
      </Dialog>
    </>
  );
}
