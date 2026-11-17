import type { I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { requestLeave, type LeaveOutcome } from "./api";
import type { PurgeFailure } from "./device-state";
// 文案函数默认用全局单例（见 lingui.config.ts）；组件渲染期调用即当前语言。
import { i18n as defaultI18n } from "../localization/service";
import type { Communities, Membership } from "./service";

export class CommunityDepartureError extends Error {
  constructor(
    readonly phase: "relay" | "device",
    readonly reason: unknown,
    readonly outcome?: LeaveOutcome,
  ) {
    super(reason instanceof Error ? reason.message : String(reason), {
      cause: reason,
    });
  }
}

export type DeviceRemovalResult = Readonly<{
  membership: Membership;
  wasSelected: boolean;
  residue: readonly PurgeFailure[];
}>;
export type CommunityLeaveResult = DeviceRemovalResult &
  Readonly<{ outcome: LeaveOutcome }>;

async function forgetCommunityOnDevice(
  communities: Communities,
  membership: Membership,
  purge: boolean,
): Promise<DeviceRemovalResult> {
  const wasSelected = communities.snapshot().selected === membership.id;
  const residue = await communities.leave(membership.id, { purge });
  return { membership, wasSelected, residue };
}

export async function removeCommunityFromDevice(
  communities: Communities,
  membership: Membership,
): Promise<DeviceRemovalResult> {
  try {
    return await forgetCommunityOnDevice(communities, membership, true);
  } catch (error) {
    throw new CommunityDepartureError("device", error);
  }
}

/** Publishes first. Local cleanup starts only after the relay has settled the
 * membership, reported it absent, or denied the viewer as banned. */
export async function leaveCommunity(
  communities: Communities,
  membership: Membership,
): Promise<CommunityLeaveResult> {
  const viewer = communities.snapshot().viewer;
  let outcome: LeaveOutcome;
  try {
    outcome = await requestLeave(membership.id);
  } catch (error) {
    throw new CommunityDepartureError("relay", error);
  }
  try {
    if (communities.snapshot().viewer !== viewer)
      throw new Error("Account changed before device cleanup");
    return {
      ...(await forgetCommunityOnDevice(
        communities,
        membership,
        // A banned viewer remains a relay member and may regain access later.
        outcome !== "access-revoked",
      )),
      outcome,
    };
  } catch (error) {
    throw new CommunityDepartureError("device", error, outcome);
  }
}

export type DepartureIntent = "leave" | "remove";
export type Departure =
  | (DeviceRemovalResult & Readonly<{ intent: "remove" }>)
  | (CommunityLeaveResult & Readonly<{ intent: "leave" }>);

/** Runs the chosen departure. Removal never contacts the relay, so it stays
 * available for a community whose relay can no longer be reached. */
export async function departCommunity(
  communities: Communities,
  membership: Membership,
  intent: DepartureIntent,
): Promise<Departure> {
  return intent === "remove"
    ? { intent, ...(await removeCommunityFromDevice(communities, membership)) }
    : { intent, ...(await leaveCommunity(communities, membership)) };
}

/** The notice for a finished departure and its toast tone. Removal only
 * follows a leave its relay never settled, which may still have applied, so
 * the notice cannot claim the membership is unchanged. */
export function departedText(
  name: string,
  departure: Departure,
  i18n: I18n = defaultI18n,
): [string, "success" | "info"] {
  const residue = departure.residue.length > 0;
  if (departure.intent === "remove") {
    const removed = i18n._(
      msg`${name} was removed from this device. Its relay didn’t confirm the leave, so you may still be a member.`,
    );
    return [
      residue ? `${removed}${i18n._(residueSuffix)}` : removed,
      "success",
    ];
  }
  return [
    leftCommunityText(name, departure.outcome, residue, i18n),
    departure.outcome === "left" ? "success" : "info",
  ];
}

/** Once the relay accepts a leave, a device persistence failure has different
 * recovery copy from a request it never settled. */
export function departureFailureText(
  name: string,
  intent: DepartureIntent,
  error: unknown,
  i18n: I18n = defaultI18n,
) {
  const departure =
    error instanceof CommunityDepartureError ? error : undefined;
  if (intent === "remove")
    return deviceRemovalFailureText(name, departure?.reason ?? error, i18n);
  return departure?.phase === "device"
    ? leaveCleanupFailureText(
        name,
        departure.reason,
        departure.outcome,
        i18n,
      )
    : leaveCommunityFailureText(name, departure?.reason ?? error, i18n);
}

export function removedFromDeviceText(
  name: string,
  residue: boolean,
  i18n: I18n = defaultI18n,
) {
  const result = i18n._(
    msg`${name} was removed from this device. Your membership wasn’t changed. You can add it again later.`,
  );
  return residue ? `${result}${i18n._(residueSuffix)}` : result;
}

/** What the relay settled, plus whether any saved data outlived the purge. */
export function leftCommunityText(
  name: string,
  outcome: LeaveOutcome,
  residue: boolean,
  i18n: I18n = defaultI18n,
) {
  const settled =
    outcome === "already-absent"
      ? i18n._(
          msg`You were no longer a member of ${name}, so it was removed from this device.`,
        )
      : outcome === "access-revoked"
        ? i18n._(
            msg`You’re currently banned from ${name}, so the leave was refused. It was removed from this device and can be added again by its URL if access is restored.`,
          )
        : i18n._(msg`Left ${name}.`);
  return residue ? `${settled}${i18n._(residueSuffix)}` : settled;
}

export function deviceRemovalFailureText(
  name: string,
  error: unknown,
  i18n: I18n = defaultI18n,
) {
  const reason =
    wordsOf(error instanceof Error ? error.cause : undefined) || wordsOf(error);
  const details = reason ? ` (${reason.replace(/[.。]$/, "")})` : "";
  return `${i18n._(msg`Couldn’t remove ${name} from this device`)}${details}.${i18n._(retrySuffix)}`;
}

/** The relay has answered; only the device record failed before it changed. */
export function leaveCleanupFailureText(
  name: string,
  error: unknown,
  outcome: LeaveOutcome = "left",
  i18n: I18n = defaultI18n,
) {
  const reason = (
    wordsOf(error instanceof Error ? error.cause : undefined) || wordsOf(error)
  ).replace(/[.。]$/, "");
  const details = reason ? ` (${reason})` : "";
  if (outcome === "already-absent")
    return `${i18n._(msg`The relay no longer had a membership for ${name}, but this device couldn’t finish removing it`)}${details}.${i18n._(retrySuffix)}`;
  if (outcome === "access-revoked")
    return `${i18n._(msg`The leave was refused because you’re currently banned from ${name}, and this device couldn’t finish removing it`)}${details}.${i18n._(retrySuffix)}`;
  return `${i18n._(msg`Left ${name}, but this device couldn’t finish cleaning up`)}${details}.${i18n._(msg` Leave it again to finish.`)}`;
}

const OWNER_REFUSAL = "invalid: relay owner cannot leave";

/** A leave the relay never settled, other than refusing its owner: the
 * membership may stand, but the device can still forget the community. */
export function leaveUnsettled(error: unknown) {
  return (
    error instanceof CommunityDepartureError &&
    error.phase === "relay" &&
    error.message !== OWNER_REFUSAL
  );
}

export function leaveCommunityFailureText(
  name: string,
  error: unknown,
  i18n: I18n = defaultI18n,
) {
  const reason = error instanceof Error ? error.message : "";
  if (reason === OWNER_REFUSAL)
    return i18n._(msg`The relay owner can’t leave ${name}.`);
  return i18n._(
    msg`Couldn’t leave ${name}. Check your connection and try again.`,
  );
}

const wordsOf = (error: unknown) =>
  error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "";

/** 残留数据后缀：与各主句拼接，单独成条便于翻译。 */
const residueSuffix = msg` Some saved data couldn’t be cleared.`;
/** 重试后缀：拼接在失败主句后。 */
const retrySuffix = msg` Try again.`;
