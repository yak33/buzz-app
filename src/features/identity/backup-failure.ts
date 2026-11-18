import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";

/**
 * A failure Try again may clear: its `cause`, which Settings shows alone (it
 * has no Try again), then what first run's failed page says to do.
 * `message` 是失败页的完整句（含“请重试”后缀），`cause` 是设置页单独显示的首句。
 */
const retry = (message: MessageDescriptor, cause: MessageDescriptor) =>
  ({ cause, message, retryable: true }) as const;

export type BackupFailures = {
  readonly [K in keyof typeof kinds]: Readonly<{
    cause?: MessageDescriptor;
    message: MessageDescriptor;
    retryable: boolean;
  }>;
};

// 宏只能在编译管线下调用：vite.config.ts 会通过 Node 原生加载器加载本
// 模块（校验开发种子），所以文案表做成函数，调用期（渲染/抛错时）才求值。
const kinds = {
  unavailable: "Key backup isn’t configured for this build.",
  busy: "Another backup of this key is in progress.",
  interrupted: "The backup was interrupted.",
  timeout: "Builderlab is taking too long to confirm your backup.",
  signed_out: "Your Builderlab sign-in is no longer valid, so your key wasn’t backed up.",
  not_offered: "Builderlab doesn’t offer key backup for this account yet.",
  not_linked:
    "This key isn’t linked to your Builderlab account yet, so it can’t be backed up.",
  other_key_linked:
    "Your Builderlab account is linked to a different key, so this one can’t be backed up.",
  invalid_service:
    "Buzz couldn’t verify Builderlab’s backup service, so your key wasn’t sent.",
  refused: "Builderlab refused this backup.",
  unreachable: "Couldn’t reach Builderlab to back up your key.",
  unconfirmed: "Builderlab couldn’t confirm your backup.",
  storage: "Buzz couldn’t save backup progress on this device.",
  unknown: "Your key wasn’t backed up.",
} as const;

export type BackupFailureKind = keyof typeof kinds;

/** Why "Backing up your key…" did not complete: the copy the failed page shows
 * and whether Try again can help. Native code names its own kinds and retries
 * them all on its next wake; `unavailable`, `interrupted`, `timeout` and
 * `unknown` are the renderer's. A `cause` is what Settings shows before saying
 * a later Builderlab sign-in tries again: every retryable kind's, and
 * `signed_out`'s, which a new sign-in clears though a retry sending the same
 * credential cannot. `retryable` is that default; first run's backup step
 * overrides it for `signed_out`, since its Try again signs in again first
 * (`backupKey` in Welcome.tsx). No message carries a service or IPC
 * answer. A leaf module: vite.config.ts validates the development seed
 * against it through Node's native loader. */
export function backupFailures(): BackupFailures {
  return {
    unavailable: {
      message: msg`Key backup isn’t configured for this build. You can continue without a backup.`,
      retryable: false,
    },
    busy: retry(
      msg`Another backup of this key is in progress. Try again in a moment.`,
      msg`Another backup of this key is in progress.`,
    ),
    interrupted: retry(
      msg`The backup was interrupted. Try again.`,
      msg`The backup was interrupted.`,
    ),
    timeout: retry(
      msg`Builderlab is taking too long to confirm your backup. Try again.`,
      msg`Builderlab is taking too long to confirm your backup.`,
    ),
    signed_out: {
      cause: msg`Your Builderlab sign-in is no longer valid, so your key wasn’t backed up.`,
      message: msg`Your Builderlab sign-in is no longer valid, so your key wasn’t backed up.`,
      retryable: false,
    },
    not_offered: {
      message: msg`Builderlab doesn’t offer key backup for this account yet.`,
      retryable: false,
    },
    not_linked: {
      message: msg`This key isn’t linked to your Builderlab account yet, so it can’t be backed up.`,
      retryable: false,
    },
    other_key_linked: {
      message: msg`Your Builderlab account is linked to a different key, so this one can’t be backed up. This key may also be refused when you use this Builderlab account to sign in to a community.`,
      retryable: false,
    },
    invalid_service: {
      message: msg`Buzz couldn’t verify Builderlab’s backup service, so your key wasn’t sent.`,
      retryable: false,
    },
    refused: {
      message: msg`Builderlab refused this backup.`,
      retryable: false,
    },
    unreachable: retry(
      msg`Couldn’t reach Builderlab to back up your key. Check your connection and try again.`,
      msg`Couldn’t reach Builderlab to back up your key.`,
    ),
    // A retry re-sends the same encrypted bytes, which kgoose treats as stored.
    unconfirmed: retry(
      msg`Builderlab couldn’t confirm your backup. Try again.`,
      msg`Builderlab couldn’t confirm your backup.`,
    ),
    storage: retry(
      msg`Buzz couldn’t save backup progress on this device. Try again.`,
      msg`Buzz couldn’t save backup progress on this device.`,
    ),
    unknown: {
      message: msg`Your key wasn’t backed up.`,
      retryable: false,
    },
  };
}

export const isBackupFailureKind = (
  value: unknown,
): value is BackupFailureKind =>
  typeof value === "string" && Object.hasOwn(kinds, value);
