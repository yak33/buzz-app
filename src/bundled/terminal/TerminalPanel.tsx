import { useLingui } from "@lingui/react/macro";
import {
  CaretDownIcon,
  StopIcon,
  ArrowsClockwiseIcon,
  TerminalWindowIcon,
} from "../../shared/design-system/icons/index";
import { Button } from "../../shared/design-system/ui/Button";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import {
  PanelHeader,
  PanelHeaderLabel,
} from "../../shared/design-system/ui/PanelHeader";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type {
  PanelProps,
  ChannelPanelContext,
} from "../../features/panels/service";
import type { TerminalSessions } from "./sessions";
import styles from "./Terminal.module.css";

export function TerminalPanel({
  channelContext,
  close,
  sessions,
}: PanelProps & { sessions: TerminalSessions }) {
  if (!channelContext) throw new Error("Terminal requires a channel context");
  return <Content context={channelContext} close={close} sessions={sessions} />;
}
function Content({
  context,
  close,
  sessions,
}: {
  context: ChannelPanelContext;
  close(): void;
  sessions: TerminalSessions;
}) {
  const { t } = useLingui();
  const version = useSyncExternalStore(
    sessions.subscribe,
    sessions.snapshot,
    sessions.snapshot,
  );
  const entry = sessions.get(context);
  const host = useRef<HTMLDivElement>(null);
  const hide = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const attempted = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    try {
      sessions.ensure(context, true);
    } catch (error) {
      setError(String(error));
    }
  }, [context, sessions]);
  useEffect(() => {
    if (entry?.screen && host.current) return entry.screen.mount(host.current);
  }, [entry?.screen]);
  // 会话状态与无会话时的说明都走翻译；原始枚举不直接展示给用户。
  const statusLabels = {
    starting: t`starting`,
    running: t`running`,
    exited: t`exited`,
    error: t`error`,
    ended: t`ended`,
  } as const;
  const statusLabel = entry
    ? statusLabels[entry.status]
    : sessions.available
      ? t`ended`
      : t`desktop only`;
  const end = async (restart: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await sessions.end(context);
      if (restart && mounted.current) sessions.ensure(context);
    } catch (error) {
      if (mounted.current) setError(String(error));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <div
      data-buzz-ui=""
      className={styles.panel}
      data-terminal-version={version}
    >
      <PanelHeader
        title={
          <PanelHeaderLabel
            title="BuzzTerm"
            icon={<TerminalWindowIcon size="1rem" />}
          >
            <div className={styles.identity}>
              <span
                className="text-body-sm text-secondary"
                title={entry?.context.channelId ?? context.channelId}
              >
                #{entry?.context.channelName ?? context.channelName}
              </span>
              {entry?.context.threadId && (
                <span
                  className="text-mono-sm text-secondary font-mono"
                  title={entry.context.threadId}
                >
                  {t`Thread ${entry.context.threadId.slice(0, 8)}`}
                </span>
              )}
              <span className="text-body-sm text-secondary">
                {statusLabel}
              </span>
            </div>
          </PanelHeaderLabel>
        }
        actions={
          <>
            {sessions.available &&
              (entry ? (
                <IconButton
                  size="toolbar"
                  disabled={busy}
                  onClick={() => void end(true)}
                  aria-label={t`Restart`}
                  title={t`Restart terminal`}
                  icon={<ArrowsClockwiseIcon size={16} aria-hidden="true" />}
                />
              ) : (
                <Button
                  size="compact"
                  disabled={busy}
                  onClick={() => void end(true)}
                >
                  {t`Start session`}
                </Button>
              ))}
            {entry && (
              <IconButton
                size="toolbar"
                disabled={busy}
                onClick={(event) => {
                  // Move focus before End removes/disables its own control.
                  // No post-await focus change can steal a later destination.
                  if (document.activeElement === event.currentTarget)
                    hide.current?.focus();
                  void end(false);
                }}
                aria-label={t`End session`}
                title={t`End session`}
                icon={<StopIcon size={16} aria-hidden="true" />}
              />
            )}
            <IconButton
              hint="familiar"
              size="toolbar"
              ref={hide}
              onClick={close}
              aria-label={t`Hide terminal`}
              title={t`Hide terminal (Cmd/Ctrl+J)`}
              icon={<CaretDownIcon size={16} aria-hidden="true" />}
            />
          </>
        }
      />
      {!sessions.available ? (
        <p className={`${styles.notice} text-body`}>
          {t`Open Buzz Desktop to use your local shell. The browser cannot start a terminal on your computer.`}
        </p>
      ) : (
        <>
          {(error || entry?.error) && (
            <p
              className={`${styles.notice} text-body text-danger`}
              role="alert"
            >
              {error ?? entry?.error}
            </p>
          )}
          {entry?.status === "starting" && (
            <p className={`${styles.notice} text-body`} role="status">
              {t`Starting your login shell…`}
            </p>
          )}
          {!entry && (
            <p className={`${styles.notice} text-body`}>
              {t`Session ended. Start a new shell to use this channel’s current context.`}
            </p>
          )}
          {/* Escape belongs to the shell while its input has focus. */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: contains the terminal's native keyboard input. */}
          <div
            className={styles.screen}
            ref={host}
            onKeyDown={(event) => {
              if (event.key === "Escape") event.stopPropagation();
            }}
          />
        </>
      )}
    </div>
  );
}
