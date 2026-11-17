import { invoke, isTauri } from "@tauri-apps/api/core";
import { msg } from "@lingui/core/macro";
// 全局单例供导出的 modelLabel 使用（先例 src/shared/datetime.ts）。
import { i18n as globalI18n } from "../../features/localization/service";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { communityDestination } from "../../features/communities/destination";
import type { RelayData } from "../../features/relay/service";
import styles from "./Compute.module.css";
import { avatarMedia } from "../../shared/avatar-source";
import { Avatar } from "../../shared/design-system/ui/Avatar";
import { InlineHeader } from "../../shared/design-system/ui/Header";
import { UsersIcon } from "../../shared/design-system/icons";
import { useIdentityNames } from "../../features/identity-names/react";

type Inventory = {
  unavailable: string | null;
  entries: {
    deviceId: string | null;
    memberPubkey: string;
    modelId: string;
    modelName: string | null;
    deviceName: string | null;
    vramGb: number | null;
  }[];
};

export function CommunityMesh({
  community,
  relay,
  refreshKey = 0,
}: {
  community: string;
  relay: RelayData;
  refreshKey?: number;
}) {
  const { t } = useLingui();
  const snapshot = useSyncExternalStore(relay.subscribe, relay.snapshot);
  const directory = snapshot.session.profiles;
  const profiles = useSyncExternalStore(
    directory.subscribe,
    directory.snapshot,
  );
  const resolveName = useIdentityNames(snapshot.session.names);
  const titleId = useId();
  const [result, setResult] = useState<{
    snapshot: typeof snapshot;
    inventory?: Inventory;
    error?: string;
  }>();
  useEffect(() => {
    void refreshKey; // The page Refresh reruns this read, without a polling owner.
    let active = true;
    setResult(undefined);
    if (!isTauri()) return;
    void (async () => {
      try {
        const inventory = await invoke<Inventory>("mesh_compute_inventory", {
          community: communityDestination(community).url,
        });
        if (!active || snapshot !== relay.snapshot()) return;
        setResult({ snapshot, inventory });
        void directory
          .ensure(
            inventory.entries.map((entry) => entry.memberPubkey),
            "foreground",
          )
          .catch(() => {});
      } catch (error) {
        if (active && snapshot === relay.snapshot())
          setResult({ snapshot, error: String(error) });
      }
    })();
    return () => {
      active = false;
    };
  }, [community, snapshot, directory, relay, refreshKey]);
  const current = result?.snapshot === snapshot ? result : undefined;
  const inventory = current?.inventory;
  const error = current?.error ?? inventory?.unavailable;
  const entries = inventory?.entries ?? [];
  const contributors = new Set(entries.map((entry) => entry.memberPubkey)).size;
  const modelCount = new Set(entries.map((entry) => entry.modelId)).size;
  // One device may advertise several models: count each identified device once.
  // Unknown device identity or capacity is not guessed into the total.
  const devices = new Map<string, number>();
  let unknownCapacity = false;
  for (const entry of entries) {
    if (entry.deviceId == null || entry.vramGb == null) {
      unknownCapacity = true;
      continue;
    }
    devices.set(`${entry.memberPubkey}\u0000${entry.deviceId}`, entry.vramGb);
  }
  // The shared naming layer covers profile names, this app's own agents, and
  // qualifies namesakes among the contributors. Never show a key fragment.
  const memberKeys = [...new Set(entries.map((entry) => entry.memberPubkey))];
  const memberName = (pubkey: string) =>
    resolveName(
      pubkey,
      profiles.get(pubkey)?.name || t`Unnamed member`,
      memberKeys,
    );
  const shared = groupDevices(entries, snapshot.viewer, memberName, t`You`);
  const sharedGb =
    devices.size && !unknownCapacity
      ? [...devices.values()].reduce((total, gb) => total + gb, 0)
      : null;
  return (
    <section aria-labelledby={titleId} className={styles.sharing}>
      <InlineHeader
        id={titleId}
        level={2}
        icon={<UsersIcon size={20} />}
        title={t`Community mesh`}
        subtitle={
          !inventory?.entries.length
            ? t`Devices members are sharing with this community.`
            : contributors === 1
              ? t`1 person is contributing compute.`
              : t`${contributors} people are contributing compute.`
        }
      />
      {!isTauri() ? (
        <p role="status">{t`Open Buzz desktop to see community mesh.`}</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !inventory ? (
        <p role="status">{t`Loading community mesh…`}</p>
      ) : inventory.entries.length === 0 ? (
        <p role="status">{t`No one is sharing compute yet.`}</p>
      ) : (
        <>
          <dl className={styles.metrics}>
            <div>
              <dt className="text-metadata">{t`Shared memory`}</dt>
              <dd className="m-0 text-heading tabular-nums">
                {sharedGb == null ? t`Not reported` : `${Math.round(sharedGb)} GB`}
              </dd>
            </div>
            <div>
              <dt className="text-metadata">{t`Devices`}</dt>
              <dd className="m-0 text-heading tabular-nums">{shared.length}</dd>
            </div>
            <div>
              <dt className="text-metadata">{t`Models available`}</dt>
              <dd className="m-0 text-heading tabular-nums">{modelCount}</dd>
            </div>
          </dl>
          <ul aria-label={t`Shared devices`} className={styles.devices}>
            {shared.map((device) => {
              const picture = profiles.get(device.memberPubkey)?.picture;
              return (
                <li key={device.key} className={styles.device}>
                  <Avatar
                    alt=""
                    fallback={memberName(device.memberPubkey)}
                    src={avatarMedia(picture, snapshot.session.media)}
                    size="default"
                  />
                  <div className={styles.deviceBody}>
                    <p className="m-0 text-body">
                      {device.name ?? t`Unnamed device`}
                      <span className="text-secondary">
                        {" · "}
                        {device.owner}
                      </span>
                    </p>
                    <p className="m-0 text-body-sm text-secondary">
                      {device.models.map((model, index) => (
                        <span key={model} title={model}>
                          {index > 0 && ", "}
                          {modelLabel(model)}
                        </span>
                      ))}
                    </p>
                  </div>
                  <p
                    className={`m-0 text-body-sm text-secondary ${styles.deviceMemory}`}
                  >
                    {device.vramGb == null
                      ? t`Not reported`
                      : `${Math.round(device.vramGb)} GB`}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

type SharedDevice = {
  key: string;
  memberPubkey: string;
  self: boolean;
  owner: string;
  name: string | null;
  vramGb: number | null;
  models: string[];
};

/**
 * One row per advertised device; its models collapse onto that row. An entry
 * without a device identity stays its own row rather than being merged by
 * guesswork. The viewer's own devices lead, then members and devices by name.
 */
function groupDevices(
  entries: Inventory["entries"],
  viewer: string | undefined,
  memberName: (pubkey: string) => string,
  you: string,
): SharedDevice[] {
  const devices = new Map<string, SharedDevice>();
  for (const entry of entries) {
    const key = `${entry.memberPubkey}\u0000${entry.deviceId ?? `model:${entry.modelId}`}`;
    const device = devices.get(key) ?? {
      key,
      memberPubkey: entry.memberPubkey,
      self: entry.memberPubkey === viewer,
      owner: entry.memberPubkey === viewer ? you : memberName(entry.memberPubkey),
      name: entry.deviceName,
      vramGb: entry.vramGb,
      models: [],
    };
    device.name ??= entry.deviceName;
    device.vramGb ??= entry.vramGb;
    const model = entry.modelName || entry.modelId;
    if (!device.models.includes(model)) device.models.push(model);
    devices.set(key, device);
  }
  return [...devices.values()].sort(
    (left, right) =>
      Number(right.self) - Number(left.self) ||
      left.owner.localeCompare(right.owner) ||
      (left.name ?? "").localeCompare(right.name ?? ""),
  );
}

/**
 * Mesh advertises routing refs (`org/Name-GGUF:QUANT`). Show the model and
 * quantization; the exact ref stays available as the row's tooltip.
 */
export function modelLabel(ref: string): string {
  const bare = ref.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const [path = bare, quant] = bare.split(":");
  const name = (path.split("/").at(-1) ?? path)
    .replace(/[-_.]gguf$/i, "")
    .replace(/@[\w.-]+$/, "");
  if (/^sha256-[0-9a-f]+$/i.test(name))
    return globalI18n._(msg`Local model`);
  return quant ? `${name} · ${quant}` : name;
}
