import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";

/**
 * A failure Try again may clear: its `cause`, which Settings shows alone (it
 * has no Try again), then what first run's failed page says to do.
 * `message` 是失败页的完整句（含“请重试”后缀），`cause` 是设置页单独显示的首句。
 */
const retry = (message: MessageDescriptor, cause: MessageDescriptor) =>
  ({ cause, message, retryable: true }) as const;

/**
 * Why "Backing up your key…" did not complete: the copy the failed page shows
 * and whether Try again can help. Native code names its own kinds and retries
 * them all on its next wake; `unavailable`, `interrupted`, `timeout` and
 * `unknown` are the renderer's. A `cause` is what Settings shows before saying
 * a later Builderlab sign-in tries again: every retryable kind's, and
 * `signed_out`'s, which a new sign-in clears though a retry sending the same
 * credential cannot. `retryable` is that default; first run's backup step
 * overrides it for `signed_out`, since its Try again signs in again first
 * (`backupKey` in Welcome.tsx). No message carries a service or IPC
 * answer. A leaf module: vite.config.ts validates the development seed
 * against it through Node's native loader.
 */
export const BACKUP_FAILURES = {
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
} as const satisfies Record<
  string,
  Readonly<{
    cause?: MessageDescriptor;
    message: MessageDescriptor;
    retryable: boolean;
  }>
>;

export type BackupFailureKind = keyof typeof BACKUP_FAILURES;

export const isBackupFailureKind = (
  value: unknown,
): value is BackupFailureKind =>
  typeof value === "string" && Object.hasOwn(BACKUP_FAILURES, value);
