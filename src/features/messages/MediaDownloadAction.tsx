import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useEffectEvent, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { useToastNotification } from "../../shared/design-system/ui/Toast";
import {
  ArrowsClockwiseIcon,
  CheckIcon,
  DownloadIcon,
} from "../../shared/design-system/icons";
import { useNativeDownload } from "./use-native-download";
import { isNativeMediaSource } from "./attachment-source";

const FAILURE_DURATION = 6000;
// Message descriptors: callers translate at the render/notify site.
const SAVED = msg`Saved to Downloads`;
const FAILED = msg`Couldn’t download. Try again.`;

export function MediaDownloadAction({
  source,
  name = "",
  kind,
  compact = false,
  savedDuration = 4000,
  onFeedbackVisible,
}: {
  source: string;
  name?: string | undefined;
  kind: string;
  compact?: boolean;
  savedDuration?: number;
  onFeedbackVisible?: ((visible: boolean) => void) | undefined;
}) {
  if (!isNativeMediaSource(source)) return null;
  return (
    <NativeMediaDownload
      key={JSON.stringify([source, name, kind])}
      source={source}
      name={name}
      kind={kind}
      compact={compact}
      savedDuration={savedDuration}
      onFeedbackVisible={onFeedbackVisible}
    />
  );
}

function NativeMediaDownload({
  source,
  name,
  kind,
  compact,
  savedDuration,
  onFeedbackVisible,
}: {
  source: string;
  name: string;
  kind: string;
  compact: boolean;
  savedDuration: number;
  onFeedbackVisible?: ((visible: boolean) => void) | undefined;
}) {
  const { i18n, t } = useLingui();
  const { state, download } = useNativeDownload(source, name, savedDuration);
  // The failure notice expires like the copy error; the retry icon remains.
  const [failureExpired, setFailureExpired] = useState(false);
  const failureShown = state === "failed" && !failureExpired;
  useEffect(() => {
    if (!failureShown) return;
    const timer = setTimeout(() => setFailureExpired(true), FAILURE_DURATION);
    return () => clearTimeout(timer);
  }, [failureShown]);
  const feedbackVisible =
    state === "pending" || state === "saved" || failureShown;
  useEffect(() => {
    onFeedbackVisible?.(feedbackVisible);
    return () => onFeedbackVisible?.(false);
  }, [feedbackVisible, onFeedbackVisible]);
  return (
    <>
      <IconButton
        hint="familiar"
        size="sm"
        type="button"
        aria-label={
          state === "failed" ? t`Retry download ${kind}` : t`Download ${kind}`
        }
        title={
          state === "failed" ? t`Retry download ${kind}` : t`Download ${kind}`
        }
        loading={state === "pending"}
        onClick={() => {
          setFailureExpired(false);
          void download();
        }}
        icon={
          state === "failed" ? (
            <ArrowsClockwiseIcon size={17} aria-hidden="true" />
          ) : state === "saved" ? (
            <CheckIcon size={17} aria-hidden="true" />
          ) : (
            <DownloadIcon size={17} aria-hidden="true" />
          )
        }
      />
      {/* Stays mounted so screen readers announce the first change. */}
      <span
        data-download-feedback={feedbackVisible ? "" : undefined}
        role={failureShown ? "alert" : "status"}
        className={feedbackVisible ? undefined : "sr-only"}
      >
        {state === "pending"
          ? t`Downloading…`
          : state === "saved"
            ? compact
              ? t`Downloaded`
              : i18n._(SAVED)
            : failureShown
              ? compact
                ? t`Download failed`
                : i18n._(FAILED)
              : ""}
      </span>
    </>
  );
}

/** Results of the native media menu's Download, which has no control to show them. */
export function MediaMenuDownloadNotice() {
  const { i18n } = useLingui();
  const notify = useToastNotification();
  // The host sends the saved file's name, or null if the download failed.
  const show = useEffectEvent((name: string | null) => {
    if (name === null) notify(i18n._(FAILED), "error");
    else notify(i18n._(SAVED), "success");
  });
  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    let unlisten = () => {};
    listen<string | null>("media-menu-download", ({ payload }) =>
      show(payload),
    ).then(
      (stop) => {
        if (active) unlisten = stop;
        else stop();
      },
      () => {},
    );
    return () => {
      active = false;
      unlisten();
    };
  }, []);
  return null;
}
