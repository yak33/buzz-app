import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { ManagementRow } from "../ManagementRow";
import { ManagementHeader } from "../BuilderlabSettings";
import type { OverviewObserver } from "../overview";
import { ManagementSection } from "../ManagementSection";
import communitiesHero from "../assets/communities-hero.png";
import { Tabs } from "../../../shared/design-system/ui/Tabs";
import { SearchField } from "../../../shared/design-system/ui/SearchField";
import { IconButton } from "../../../shared/design-system/ui/IconButton";
import { Tooltip } from "../../../shared/design-system/ui/Tooltip";
import {
  PopoverRoot,
  PopoverPopup,
} from "../../../shared/design-system/ui/Popover";
import {
  MenuRoot,
  MenuTrigger,
  MenuPopup,
  MenuItem,
  MenuIcon,
} from "../../../shared/design-system/ui/Menu";
import { SettingsGroup } from "../../../shared/design-system/ui/SettingsGroup";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { npubEncode } from "nostr-tools/nip19";
import { AlertDialog } from "../../../shared/design-system/ui/AlertDialog";
import { Button } from "../../../shared/design-system/ui/Button";
import { Checkbox } from "../../../shared/design-system/ui/Checkbox";
import { Dialog } from "../../../shared/design-system/ui/Dialog";
import { EmptyState } from "../../../shared/design-system/ui/EmptyState";
import { InlineHeader } from "../../../shared/design-system/ui/Header";
import { Field } from "../../../shared/design-system/ui/Field";
import { Input } from "../../../shared/design-system/ui/Input";
import {
  ArchiveIcon,
  ArrowSquareOutIcon,
  ArrowsClockwiseIcon,
  ArrowsLeftRightIcon,
  BoxArrowUpIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleNotchIcon,
  GlobeIcon,
  DotsThreeIcon,
  SignOutIcon,
  TrashIcon,
  WarningCircleIcon,
} from "../../../shared/design-system/icons";
import {
  ApiFailure,
  boundKey,
  check,
  clearPendingDeletion,
  isDefinitiveDeletionRejection,
  makePendingDeletion,
  persistPendingDeletion,
  quota,
  quotaLimitMessage,
  readPendingDeletion,
  relayUrl,
  Unsupported,
  type Account,
  type Api,
  type Community,
  type Identity,
  type PendingDeletion,
  type Quota,
} from "./api";
import { writeClipboardText } from "../../../shared/clipboard";
import { CommunityAddressField, useCommunityAddress } from "./CommunityAddress";

const card = "mt-6 rounded-xl border border-default p-5";
const sectionClassName = "mt-section-gap";
const refreshFailure = msg`The change was saved, but the list could not be refreshed.`;
const npub = (hex?: string | null) => (hex ? npubEncode(hex) : "Unavailable");
const message = (reason: unknown) =>
  reason instanceof Error ? reason.message : String(reason);
type Confirm = {
  title: string;
  description: string;
  action: string;
  /** Both start on Cancel; permanent also shows the action in red. */
  caution?: "permanent" | "guarded";
  run(): Promise<void>;
};

export function HostedCommunities({
  api,
  active,
  join,
  sharedSignIn = false,
  onOverview,
  navigation,
  initialCreate = false,
  onCreateClose,
}: {
  api: Api;
  active(): boolean;
  /** Opens the app's join dialog on a community this account just created;
   * false when it cannot, and the address is handed off instead. */
  join?: ((address: string) => boolean) | undefined;
  /** The surrounding page owns sign-in, sign-out and the account row. */
  sharedSignIn?: boolean;
  onOverview?: OverviewObserver;
  navigation?: ReactNode;
  /** Picker entry opens the existing form once the account checks complete. */
  initialCreate?: boolean;
  /** Explicit dismissal or completion retires the caller's creation intent. */
  onCreateClose?: (() => void) | undefined;
}) {
  const { i18n, t } = useLingui();
  const activeRef = useRef(active);
  activeRef.current = active;
  const [auth, setAuth] = useState<Account | null>();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [identityLoadFailed, setIdentityLoadFailed] = useState(false);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [listTab, setListTab] = useState<"active" | "archived">("active");
  const [listQuery, setListQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(initialCreate);
  const needle = listQuery.trim().toLowerCase();
  const [quotaState, setQuotaState] = useState<Quota | null>(null);
  // This device's key: undefined while loading, null when it could not be read.
  const [local, setLocal] = useState<string | null>();
  const [unsupported, setUnsupported] = useState("");
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const proceed = useRef<HTMLButtonElement>(null);
  const [transfer, setTransfer] = useState<Community | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Community | null>(null);
  const [pendingDeletion, setPendingDeletion] =
    useState<PendingDeletion | null>(null);
  const [blockedOwner, setBlockedOwner] = useState<string | null>(null);
  const [deletionNotice, setDeletionNotice] = useState("");
  // The last address handed off for joining, and whether the clipboard took it.
  const [handoff, setHandoff] = useState<{
    url: string;
    copied: boolean;
  } | null>(null);
  const handoffOwner = useRef(0);
  const rowActions = useRef(new Map<string, HTMLElement>());
  const createTrigger = useRef<HTMLButtonElement>(null);
  const loginAbort = useRef<AbortController | null>(null);
  // Bumped by every operation and unmount; a read applies only if none happened since it began.
  const generation = useRef(0);
  const actionOwner = useRef(0);
  const acceptedDeletions = useRef(new Map<string, PendingDeletion>());
  const loadedOwner = useRef<string | null | undefined>(undefined);

  // biome-ignore lint/correctness/useExhaustiveDependencies: i18n._ 每次渲染重建，此效果/回调不需随语言重建。
  const load = useCallback(
    async (reconcileAccepted = false) => {
      const at = generation.current;
      const [current, list] = await Promise.all([
        api.call("identity"),
        api.call("list"),
      ]);
      if (at !== generation.current) return null;
      // A setup-needed mapping is the connect state. An upstream unauthorized
      // response may also be an expired session (browser-host/builderlab.mjs forwards it).
      if (
        current.error?.code === "unauthorized" ||
        list.error?.code === "unauthorized"
      ) {
        setIdentityLoadFailed(true);
        setIdentity(null);
        setCommunities([]);
        setQuotaState(null);
        setLoaded(false);
        setPendingDeletion(null);
        setBlockedOwner(null);
        setDeletionNotice("");
      }
      if (!current.error?.setup_needed)
        check(current, i18n._(msg`Could not load the connected Buzz identity.`));
      if (!list.error?.setup_needed)
        check(list, i18n._(msg`Could not load communities.`));
      setIdentityLoadFailed(false);
      const nextIdentity = current.identity ?? null;
      const nextOwner = boundKey(nextIdentity);
      if (
        loadedOwner.current !== undefined &&
        loadedOwner.current !== nextOwner
      ) {
        acceptedDeletions.current.clear();
        setDeletionNotice("");
      }
      loadedOwner.current = nextOwner;
      const stored = readPendingDeletion();
      setBlockedOwner(
        stored &&
          (stored.owner_pubkey !== nextOwner ||
            stored.backend_origin !== api.origin())
          ? stored.owner_pubkey
          : null,
      );
      setPendingDeletion(
        stored?.owner_pubkey === nextOwner &&
          stored.backend_origin === api.origin()
          ? stored
          : null,
      );
      const listed = list.communities ?? [];
      if (
        reconcileAccepted &&
        nextOwner &&
        listed.some((community) =>
          acceptedDeletions.current.has(community.id ?? ""),
        )
      ) {
        const currentAuth = await api.getAuth().catch(() => null);
        if (at !== generation.current || !activeRef.current()) return null;
        if (currentAuth?.capabilities?.can_delete_buzz_communities === true)
          for (const community of listed) {
            if (at !== generation.current || !activeRef.current()) return null;
            const accepted = acceptedDeletions.current.get(community.id ?? "");
            if (!accepted || accepted.owner_pubkey !== nextOwner) continue;
            try {
              await api.admitDeletion(accepted.request, "recovery");
            } catch (reason) {
              if (
                at === generation.current &&
                activeRef.current() &&
                acceptedDeletions.current.get(accepted.request.community_id) ===
                  accepted
              ) {
                if (
                  reason instanceof ApiFailure &&
                  reason.code === "deletion_aborted"
                ) {
                  acceptedDeletions.current.delete(
                    accepted.request.community_id,
                  );
                  if (acceptedDeletions.current.size === 0)
                    setDeletionNotice("");
                  setError(
                    i18n._(
                      msg`Deletion of ${accepted.request.host} stopped. This community is not being deleted.`,
                    ),
                  );
                } else setError(i18n._(msg`Couldn't check deletion status.`));
              }
            }
            if (at !== generation.current || !activeRef.current()) return null;
          }
      }
      const nextCommunities = listed.filter(
        (community) =>
          !community.id || !acceptedDeletions.current.has(community.id),
      );
      const nextQuota = quota(list);
      setIdentity(nextIdentity);
      setCommunities(nextCommunities);
      setQuotaState(nextQuota);
      setLoaded(true);
      return { identity: nextIdentity, communities: nextCommunities };
    },
    [api],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: i18n._ 每次渲染重建，此效果/回调不需随语言重建。
  const markDeletionAccepted = useCallback(
    (pending: PendingDeletion, at: number) => {
      if (at !== generation.current || !activeRef.current()) return false;
      clearPendingDeletion(pending);
      acceptedDeletions.current.set(pending.request.community_id, pending);
      setPendingDeletion(null);
      setCommunities((list) =>
        list.filter((item) => item.id !== pending.request.community_id),
      );
      setDeletionNotice(i18n._(msg`Deletion started`));
      setError("");
      return true;
    },
    [],
  );

  const localRead = useRef(0);
  const loadLocal = useCallback(() => {
    const at = ++localRead.current;
    setLocal(undefined);
    void api
      .localKey()
      .then((key) => at === localRead.current && setLocal(key));
  }, [api]);

  useEffect(() => {
    const at = ++generation.current;
    loadLocal();
    void api
      .getAuth()
      .then((next) => {
        if (at !== generation.current) return;
        setAuth(next);
        if (next)
          return load().catch(
            (reason) => at === generation.current && setError(message(reason)),
          );
      })
      .catch((reason) => {
        if (at !== generation.current) return;
        setAuth(null);
        if (reason instanceof Unsupported) setUnsupported(reason.message);
        else setError(message(reason));
      });
    return () => {
      generation.current++;
      loginAbort.current?.abort();
    };
  }, [api, load, loadLocal]);

  /** Runs one account operation at a time; resolves whether it succeeded. */
  async function run(label: string, operation: () => Promise<unknown>) {
    if (!activeRef.current()) return false;
    const at = ++generation.current;
    const owner = ++actionOwner.current;
    setAction(label);
    setError("");
    try {
      await operation();
      return true;
    } catch (reason) {
      if (at === generation.current) setError(message(reason));
      return false;
    } finally {
      if (owner === actionOwner.current) setAction(null);
    }
  }
  const copy = async (url: string) => {
    // A retired card must not start a clipboard write.
    if (!activeRef.current()) return;
    const at = handoffOwner.current;
    const copied = await Promise.resolve()
      .then(() => writeClipboardText(url))
      .then(
        () => true,
        () => false,
      );
    if (at === handoffOwner.current) setHandoff({ url, copied });
  };
  /** Refreshes after a confirmed write; a failed read must not present the write as failed. */
  const settle = () => {
    const at = generation.current;
    // 先求值刷新失败前缀，避免在 t`` 插值里混入宏调用。
    const prefix = i18n._(refreshFailure);
    return load().catch(
      (reason) =>
        at === generation.current &&
        setError(
          t`${prefix} ${message(reason)} Use Refresh to try again.`,
        ),
    );
  };
  const settleDeletion = async (
    pending: PendingDeletion,
    at: number,
    operation: () => Promise<unknown>,
  ) => {
    try {
      await operation();
      if (!markDeletionAccepted(pending, at)) return false;
      await settle();
      return true;
    } catch (reason) {
      if (at !== generation.current || !activeRef.current()) return false;
      if (
        (reason instanceof ApiFailure && reason.code === "deletion_aborted") ||
        isDefinitiveDeletionRejection(reason)
      ) {
        clearPendingDeletion(pending);
        setPendingDeletion(null);
        if (reason instanceof ApiFailure && reason.code === "deletion_aborted")
          await load().catch(() => undefined);
      } else setPendingDeletion(pending);
      throw reason;
    }
  };
  const checkPendingDeletion = (pending: PendingDeletion) =>
    run("delete", async () => {
      const at = generation.current;
      const snapshot = await load();
      if (at !== generation.current || !activeRef.current()) return;
      const currentAuth = await api.getAuth();
      if (at !== generation.current || !activeRef.current()) return;
      const stored = readPendingDeletion();
      if (
        !snapshot ||
        !stored ||
        JSON.stringify(stored) !== JSON.stringify(pending) ||
        stored.backend_origin !== api.origin() ||
        boundKey(snapshot.identity) !== pending.owner_pubkey
      )
        throw new Error(
          i18n._(
            msg`This deletion request no longer matches the current account. Sign in with the original account to check its status.`,
          ),
        );
      setAuth(currentAuth);
      if (currentAuth?.capabilities?.can_delete_buzz_communities !== true)
        throw new Error(
          i18n._(msg`Community deletion is no longer available.`),
        );
      await settleDeletion(pending, at, () =>
        api.admitDeletion(pending.request, "recovery"),
      );
    });
  /** Retries a failed account check; the surrounding page keeps the shared session. */
  const retryAuth = () =>
    run("retry", async () => {
      const at = generation.current;
      const next = await api.getAuth();
      if (at !== generation.current || !activeRef.current()) return;
      setAuth(next);
      if (next) await load();
    });
  const busy = action !== null;
  const refreshAction = (
    <IconButton
      variant="ghost"
      size="sm"
      aria-label={t`Refresh`}
      title={t`Refresh`}
      icon={<ArrowsClockwiseIcon aria-hidden="true" />}
      loading={action === "refresh"}
      disabled={busy}
      onClick={() => void run("refresh", () => load(true))}
    />
  );
  const focusRead = useRef(false);
  const refreshOnFocus = useEffectEvent(() => {
    if (
      !activeRef.current() ||
      !auth ||
      busy ||
      focusRead.current ||
      createOpen ||
      confirm ||
      transfer ||
      deleteTarget
    )
      return;
    const at = generation.current;
    focusRead.current = true;
    void load()
      .then(
        (snapshot) => {
          if (snapshot && at === generation.current)
            setError((current) =>
              !loaded || current.startsWith(i18n._(refreshFailure))
                ? ""
                : current,
            );
        },
        (reason) => {
          if (
            at === generation.current &&
            (!loaded ||
              (reason instanceof ApiFailure && reason.code === "unauthorized"))
          )
            setError(message(reason));
        },
      )
      .finally(() => {
        focusRead.current = false;
      });
  });
  useEffect(() => {
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, []);
  // Repeated inside open dialogs, whose modal backdrop hides the page copy.
  const failure = error && (
    <p role="alert" className="error flex items-start gap-2 break-words">
      <WarningCircleIcon
        size={16}
        aria-hidden="true"
        className="mt-0.5 shrink-0"
      />
      <span className="min-w-0 wrap-anywhere">{error}</span>
    </p>
  );
  const bound = boundKey(identity);
  // Without a usable bound key, the account cannot prove which identity it acts for.
  const mismatch =
    Boolean(identity) && (!bound || (Boolean(local) && bound !== local));
  // Acting requires this device's key to be known and to match the account's.
  const ready = bound !== null && bound === local;
  const connected = Boolean(auth) && ready && !identityLoadFailed;
  const connectedMark = connected ? (
    <Tooltip
      content={t`This Builderlab account is connected to this device’s Buzz identity.`}
    >
      <span
        // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users need the connection description too.
        tabIndex={0}
        role="img"
        aria-label={t`Buzz identity connected`}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-affordance-success"
      >
        <CheckIcon size={16} aria-hidden="true" color="var(--icon-success)" />
      </span>
    </Tooltip>
  ) : null;
  const deletionEnabled =
    auth?.capabilities?.can_delete_buzz_communities === true;
  // A handoff belongs to the bound identity: whenever it changes, by a local
  // action or a refresh, drop the handoff and any clipboard result in flight.
  // Layout effect, so a stale handoff is never painted beside the new identity.
  // biome-ignore lint/correctness/useExhaustiveDependencies: bound is the trigger.
  useLayoutEffect(() => {
    handoffOwner.current++;
    setHandoff(null);
  }, [bound]);
  // Joining guidance is never offered for an address the card knows is archived,
  // including a clipboard result that lands after the archive.
  const shown =
    handoff &&
    !communities.some(
      (item) => item.archived_at && relayUrl(item) === handoff.url,
    )
      ? handoff
      : null;

  const bind = async () => {
    const reply = check(
      await api.call("bind"),
      i18n._(msg`Could not connect the Buzz identity.`),
    );
    setIdentity(reply.identity ?? null);
    await settle();
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: i18n._ 每次渲染重建，此效果/回调不需随语言重建。
  useLayoutEffect(() => {
    if (!activeRef.current() || !onOverview) return;
    if (auth === undefined) return onOverview({ kind: "pending" });
    if (!auth)
      return onOverview({ kind: error || unsupported ? "failed" : "empty" });
    if (!loaded) return onOverview({ kind: error ? "failed" : "pending" });
    const own = (community: Community) =>
      community.owner_pubkey === bound ? 0 : 1;
    const created = (community: Community) =>
      Date.parse(community.created_at ?? "") || 0;
    const shown = communities
      .filter((community) => !community.archived_at)
      .sort((a, b) => own(a) - own(b) || created(b) - created(a));
    onOverview(
      shown.length
        ? {
            kind: "filled",
            items: shown.map((community, index) => ({
              key: community.id ?? String(index),
              label: community.name ?? t`Untitled`,
            })),
          }
        : { kind: "empty" },
    );
  }, [onOverview, auth, error, unsupported, loaded, communities, bound]);
  const mutate = async (
    kind: "archive" | "unarchive",
    community: Community,
    fallback: string,
  ) => {
    const reply = await api.call(kind, { community_id: community.id ?? "" });
    const archivedAt = reply.community?.archived_at;
    const done = kind === "archive" ? Boolean(archivedAt) : archivedAt === null;
    if (!done) check(reply, fallback);
    // Apply the confirmed state now, so a failed refresh cannot leave the row's old actions.
    if (done)
      setCommunities((list) =>
        list.map((item) =>
          item.id === community.id
            ? { ...item, archived_at: archivedAt ?? null }
            : item,
        ),
      );
    await settle();
  };

  const identityControls = auth ? (
    <>
      {!sharedSignIn && <InlineHeader title={t`Account`} />}
      <SettingsGroup layout="form">
        {!sharedSignIn && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="m-0 text-label">
                {auth.name || auth.email || t`Builderlab account`}
              </p>
              {auth.name && auth.email && (
                <p className="m-0 text-body-sm text-muted">{auth.email}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                void run("sign-out", async () => {
                  await api.signOut();
                  setPendingDeletion(null);
                  setAuth(null);
                  setIdentity(null);
                  setCommunities([]);
                  setQuotaState(null);
                  setLoaded(false);
                })
              }
            >
              <SignOutIcon aria-hidden="true" /> {t`Sign out`}
            </Button>
          </div>
        )}
        {!identity ? (
          identityLoadFailed ? null : (
            <div className="space-y-3">
              <InlineHeader
                title={t`Link this account to your Buzz identity`}
                subtitle={t`This Builderlab account isn’t linked to a Buzz identity yet. Connect this device’s key to create and own communities under it — Buzz signs a one-time challenge locally. Connecting shares the signed proof and your public identity.`}
              />
              <Button
                variant="primary"
                loading={action === "bind"}
                disabled={busy}
                onClick={() => void run("bind", bind)}
              >
                {t`Connect Buzz identity`}
              </Button>
            </div>
          )
        ) : local === undefined && bound ? (
          <p role="status" className="space-y-3">
            {t`Checking this device’s Buzz identity…`}
          </p>
        ) : local === null && bound ? (
          <div className="space-y-3">
            <p role="alert" className="error m-0">
              {t`Could not read this device’s Buzz identity, so community actions are paused.`}
            </p>
            <div className="mt-3">
              <Button onClick={loadLocal}>{t`Try again`}</Button>
            </div>
          </div>
        ) : mismatch ? (
          <section className="space-y-3" aria-label={t`Identity mismatch`}>
            <InlineHeader
              icon={<WarningCircleIcon size={16} aria-hidden="true" />}
              title={t`This account is connected to a different Buzz identity`}
            />
            <p className="text-body-sm text-muted">
              {t`Your Builderlab account is linked to another Buzz key. Creating communities and copying addresses are paused until the identities match. To keep the account’s key, sign in to Buzz on this device with that key instead of switching.`}
            </p>
            <dl className="text-body-sm">
              <dt className="text-muted">{t`Account uses`}</dt>
              <dd className="m-0 break-all font-mono">{npub(bound)}</dd>
              <dt className="mt-2 text-muted">{t`This device`}</dt>
              <dd className="m-0 break-all font-mono">{npub(local)}</dd>
            </dl>
            <Button
              variant="primary"
              disabled={busy || !local}
              onClick={() =>
                setConfirm({
                  title: t`Switch to this device’s identity?`,
                  // kgoose revokes an unlinked key: binding it again answers 409.
                  // The client can't tell whether this device's key already was.
                  description: t`The key your account uses now will be permanently unlinked. It can never be linked to a Builderlab account again. If this device’s key was unlinked before, Builderlab refuses it too, and your account is left with no key.`,
                  action: t`Switch identity`,
                  caution: "permanent",
                  run: async () => {
                    check(
                      await api.call("unbind"),
                      i18n._(
                        msg`Could not release the previously connected Buzz identity.`,
                      ),
                    );
                    setPendingDeletion(null);
                    // Unbound is a valid resting state; Connect recovers it.
                    setIdentity(null);
                    // The unlink is done: retire its confirmation so a
                    // failed bind is never retried by unlinking again.
                    setConfirm(null);
                    if (activeRef.current()) await bind();
                  },
                })
              }
            >
              {t`Switch to this device’s identity`}
            </Button>
          </section>
        ) : sharedSignIn ? null : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 flex min-w-0 flex-wrap items-center gap-2 text-body-sm">
              <CheckCircleIcon size={16} aria-hidden="true" />
              {t`Buzz identity connected`}{" "}
              <span className="break-all font-mono text-muted">
                {npub(bound)}
              </span>
            </p>
          </div>
        )}
      </SettingsGroup>
    </>
  ) : null;

  return (
    <section
      aria-busy={busy}
      aria-labelledby="hosted-communities-title"
      onKeyDown={(event) => {
        // The hint leaves focus on its action, outside the popup's key handler.
        if (shown && event.key === "Escape" && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.stopPropagation();
          setHandoff(null);
        }
      }}
    >
      <ManagementHeader
        navigation={navigation}
        id="hosted-communities-title"
        title={t`Communities`}
        align="end"
        actions={
          <Button
            ref={createTrigger}
            variant="prominent"
            aria-label={t`Create community`}
            disabled={
              !auth || !ready || busy || quotaState?.canCreate === false
            }
            onClick={() => {
              if (activeRef.current()) setCreateOpen(true);
            }}
          >
            {t`Create`}
          </Button>
        }
      />
      <ManagementSection
        hero={communitiesHero}
        facts={[
          ...(connected
            ? []
            : [
                {
                  label: t`Buzz identity`,
                  value:
                    auth === undefined || (auth && local === undefined)
                      ? "…"
                      : error || mismatch || identityLoadFailed
                        ? t`Needs attention`
                        : ready
                          ? t`Connected`
                          : t`Not connected`,
                },
              ]),
        ]}
        aside={
          (!sharedSignIn || !ready || quotaState?.canCreate === false) && (
            <>
              {(!sharedSignIn || !ready) && identityControls}
              {quotaState?.canCreate === false && (
                <p className="text-body-sm text-subtle">
                  {quotaLimitMessage(quotaState.limit)}
                </p>
              )}
            </>
          )
        }
      >
        {auth && communities.length === 0 && (
          <div className="flex items-center justify-end gap-2">
            {refreshAction}
            {connectedMark}
          </div>
        )}
        {!createOpen && failure}
        {unsupported ? (
          <p className={`${sectionClassName} text-body-sm text-muted`}>
            {unsupported}
          </p>
        ) : auth === undefined ? (
          <p
            role="status"
            className="flex items-center gap-2 text-body-sm text-muted"
          >
            <CircleNotchIcon
              size={16}
              aria-hidden="true"
              className="motion-safe:animate-spin"
            />
            {t`Checking sign-in…`}
          </p>
        ) : !auth ? (
          sharedSignIn ? (
            <div className="mt-3">
              <Button
                loading={action === "retry"}
                disabled={busy}
                onClick={() => void retryAuth()}
              >
                {t`Try again`}
              </Button>
            </div>
          ) : (
            <EmptyState
              icon={<GlobeIcon />}
              title={t`Sign in to manage hosted communities`}
              description={t`Sign in through your browser to manage Builderlab hosting. The rest of Buzz works without a Builderlab account.`}
              action={
                <>
                  <Button
                    variant="primary"
                    loading={action === "login"}
                    disabled={busy}
                    onClick={() =>
                      void run("login", async () => {
                        loginAbort.current = new AbortController();
                        const next = await api.login(loginAbort.current.signal);
                        setAuth(next);
                        await settle();
                      })
                    }
                  >
                    <ArrowSquareOutIcon size={18} aria-hidden="true" />{" "}
                    {t`Sign in with Builderlab`}
                  </Button>
                  {action === "login" && (
                    <Button onClick={() => loginAbort.current?.abort()}>
                      {t`Cancel`}
                    </Button>
                  )}
                </>
              }
            />
          )
        ) : (
          <>
            {deletionNotice && (
              <p role="status" className={`${card} text-body-sm`}>
                {deletionNotice}
              </p>
            )}
            {pendingDeletion && (
              <div className={card}>
                <p className="m-0 text-label">
                  {t`Deletion status is unknown`}
                </p>
                <p className="text-body-sm text-muted">
                  {t`Buzz will not check automatically. Use Check deletion status when deletion is available. This resends the same request UUID, which may admit the original intent; a failed check does not prove the earlier request was never accepted.`}
                </p>
                <p className="break-all font-mono text-body-sm">
                  {pendingDeletion.request.host}
                </p>
                <p className="text-body-sm text-muted">
                  {t`If this remains uncertain, contact support and include this Request UUID:`}
                </p>
                <p className="select-all break-all font-mono text-body-sm">
                  {pendingDeletion.request.request_id}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    loading={action === "delete"}
                    disabled={busy || !deletionEnabled || !ready}
                    onClick={() => void checkPendingDeletion(pendingDeletion)}
                  >
                    {t`Check deletion status`}
                  </Button>
                </div>
                {!deletionEnabled && (
                  <p className="text-body-sm text-muted">
                    {t`Community deletion is unavailable right now, so this request can't be checked. It stays saved on this device.`}
                  </p>
                )}
              </div>
            )}
            {deletionEnabled && blockedOwner && (
              <p role="status" className={`${card} text-body-sm`}>
                {blockedOwner === bound ? (
                  t`This identity has a deletion request saved from a different app address on this device. It can't be checked here, so contact support before starting another deletion.`
                ) : (
                  t`A deletion request from ${npub(blockedOwner)} is still pending on this device. Switch to that Buzz identity and use Check deletion status before starting another deletion here. If you no longer have that identity, contact support.`
                )}
              </p>
            )}
            {communities.length > 0 && (
              <div className="flex flex-col gap-3">
                <Tabs<"active" | "archived">
                  variant="capsule"
                  label={t`Community status`}
                  trailingAction={
                    <div className="flex w-full min-w-0 items-center gap-2 self-end sm:w-auto">
                      {refreshAction}
                      {connectedMark}
                      <div className="min-w-0 flex-1 sm:w-60">
                        <SearchField
                          variant="capsule"
                          label={t`Search communities`}
                          placeholder={t`Search`}
                          value={listQuery}
                          onValueChange={(value) => {
                            if (active()) setListQuery(value);
                          }}
                        />
                      </div>
                    </div>
                  }
                  items={[
                    { value: "active", label: t`Active` },
                    { value: "archived", label: t`Archived` },
                  ]}
                  value={listTab}
                  onValueChange={(value) => {
                    if (active()) setListTab(value);
                  }}
                  renderPanel={(panel) => {
                    // 先拆出页签词，避免在 t`` 插值里嵌套 t``。
                    const activeWord = t`Active`;
                    const archivedWord = t`Archived`;
                    const rows = communities.filter(
                      (community) =>
                        Boolean(community.archived_at) ===
                          (panel === "archived") &&
                        (!needle ||
                          [
                            community.name,
                            community.slug,
                            community.normalized_host,
                          ].some((value) =>
                            value?.toLowerCase().includes(needle),
                          )),
                    );
                    return (
                      <>
                        {rows.length === 0 && (
                          <p className="py-12 text-center text-body-sm text-secondary">
                            {needle
                              ? t`No communities match your search.`
                              : panel === "archived"
                                ? t`No archived communities.`
                                : t`No active communities.`}
                          </p>
                        )}
                        <ul
                          className="m-0 list-none p-0"
                          aria-label={t`${panel === "active" ? activeWord : archivedWord} communities`}
                        >
                          {rows.map((community, index) => {
                            const name =
                              community.name ??
                              community.slug ??
                              t`Hosted community`;
                            const url = relayUrl(community);
                            const archived = Boolean(community.archived_at);
                            const deletionPending =
                              pendingDeletion?.request.community_id ===
                              community.id;
                            return (
                              <li
                                key={
                                  community.id ??
                                  community.normalized_host ??
                                  index
                                }
                              >
                                <ManagementRow
                                  icon={<GlobeIcon size={20} />}
                                  title={name}
                                  detail={url ?? undefined}
                                  status={archived ? t`Archived` : undefined}
                                  actions={
                                      <MenuRoot>
                                        <MenuTrigger
                                          render={
                                            <IconButton
                                              ref={(button) => {
                                                if (!url) return;
                                                if (button)
                                                  rowActions.current.set(
                                                    url,
                                                    button,
                                                  );
                                                else
                                                  rowActions.current.delete(
                                                    url,
                                                  );
                                              }}
                                              variant="bare"
                                              size="sm"
                                              shape="row-end"
                                              aria-label={t`More actions for ${name}`}
                                              icon={<DotsThreeIcon size={18} />}
                                            />
                                          }
                                        />
                                        <MenuPopup
                                          align="end"
                                          aria-label={t`More actions for ${name}`}
                                        >
                                          {!archived && url && ready && (
                                            <MenuItem
                                              disabled={busy}
                                              onClick={() => void copy(url)}
                                            >
                                              {t`Copy address`}
                                            </MenuItem>
                                          )}
                                          {archived ? (
                                            <>
                                              <MenuItem
                                                disabled={
                                                  busy ||
                                                  !community.id ||
                                                  deletionPending
                                                }
                                                onClick={() =>
                                                  setConfirm({
                                                    title: t`Unarchive ${name}?`,
                                                    description: t`This address will become connectable again. Connections closed during archival will not reconnect automatically.`,
                                                    action: t`Unarchive`,
                                                    run: () =>
                                                      mutate(
                                                        "unarchive",
                                                        community,
                                                        i18n._(
                                                          msg`Could not unarchive the community.`,
                                                        ),
                                                      ),
                                                  })
                                                }
                                              >
                                                <MenuIcon>
                                                  <BoxArrowUpIcon
                                                    size={16}
                                                    aria-hidden="true"
                                                  />
                                                </MenuIcon>{" "}
                                                {t`Unarchive`}
                                              </MenuItem>
                                              {deletionEnabled &&
                                                ready &&
                                                community.id &&
                                                community.normalized_host && (
                                                  <MenuItem
                                                    tone="danger"
                                                    disabled={
                                                      busy ||
                                                      Boolean(
                                                        pendingDeletion,
                                                      ) ||
                                                      Boolean(blockedOwner)
                                                    }
                                                    onClick={() =>
                                                      setDeleteTarget(community)
                                                    }
                                                  >
                                                    <MenuIcon>
                                                      <TrashIcon
                                                        size={16}
                                                        aria-hidden="true"
                                                      />
                                                    </MenuIcon>{" "}
                                                    {t`Delete`}
                                                  </MenuItem>
                                                )}
                                            </>
                                          ) : (
                                            <>
                                              <MenuItem
                                                disabled={busy || !community.id}
                                                onClick={() =>
                                                  setTransfer(community)
                                                }
                                              >
                                                <MenuIcon>
                                                  <ArrowsLeftRightIcon
                                                    size={16}
                                                    aria-hidden="true"
                                                  />
                                                </MenuIcon>{" "}
                                                {t`Transfer ownership`}
                                              </MenuItem>
                                              <MenuItem
                                                disabled={busy || !community.id}
                                                onClick={() =>
                                                  setConfirm({
                                                    title: t`Archive ${name}?`,
                                                    description: t`New and existing connections stop and the address stays reserved. Archiving can’t be undone from here without unarchiving, and the community keeps counting toward your quota — it isn’t deleted.`,
                                                    action: t`Archive`,
                                                    caution: "guarded",
                                                    run: () =>
                                                      mutate(
                                                        "archive",
                                                        community,
                                                        i18n._(
                                                          msg`Could not archive the community.`,
                                                        ),
                                                      ),
                                                  })
                                                }
                                              >
                                                <MenuIcon>
                                                  <ArchiveIcon
                                                    size={16}
                                                    aria-hidden="true"
                                                  />
                                                </MenuIcon>{" "}
                                                {t`Archive`}
                                              </MenuItem>
                                            </>
                                          )}
                                        </MenuPopup>
                                      </MenuRoot>
                                  }
                                />
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    );
                  }}
                />
              </div>
            )}
            <PopoverRoot
              open={Boolean(shown)}
              onOpenChange={(open) => !open && setHandoff(null)}
            >
              <PopoverPopup
                side="top"
                align="end"
                size="compact"
                anchor={() =>
                  (shown && rowActions.current.get(shown.url)) ||
                  createTrigger.current
                }
                initialFocus={false}
                finalFocus={false}
                aria-label={t`Community address`}
              >
                {shown?.copied && (
                  <p role="status" className="m-0 text-body-sm text-muted">
                    {t`Address copied. To join, open the community picker and choose Join a community.`}
                  </p>
                )}
                {shown && !shown.copied && (
                  <div role="alert" className="text-body-sm">
                    <p className="m-0">
                      {t`Couldn’t copy the address. Copy it manually, then open the community picker and choose Join a community:`}
                    </p>
                    <p className="m-0 select-all break-all font-mono">
                      {shown.url}
                    </p>
                    <div className="mt-2">
                      <Button
                        disabled={busy || !ready}
                        onClick={() => void copy(shown.url)}
                      >
                        {t`Try copying again`}
                      </Button>
                    </div>
                  </div>
                )}
              </PopoverPopup>
            </PopoverRoot>
            <CreateCommunity
              open={createOpen}
              close={() => {
                setCreateOpen(false);
                onCreateClose?.();
              }}
              quotaLabel={
                quotaState
                  ? t`${quotaState.used} of ${quotaState.limit} communities used`
                  : null
              }
              failure={failure}
              api={api}
              enabled={ready && quotaState?.canCreate !== false}
              atLimit={
                quotaState?.canCreate === false
                  ? quotaLimitMessage(quotaState.limit)
                  : null
              }
              busy={busy}
              creating={action === "create"}
              onCreate={(name) =>
                run("create", async () => {
                  // `run` has just started this operation's generation.
                  const at = generation.current;
                  const reply = check(
                    await api.call("create", { name }),
                    i18n._(msg`Could not create the community.`),
                    quotaState?.limit,
                  );
                  // Join or hand off the address before refreshing, so a failed
                  // refresh cannot lose it. The join dialog connects at once, as
                  // first run's Create community does. Like the clipboard, a
                  // retired or replaced card (another account) opens nothing.
                  const url = reply.community && relayUrl(reply.community);
                  if (
                    url &&
                    !(
                      join &&
                      activeRef.current() &&
                      at === generation.current &&
                      join(url)
                    )
                  )
                    await copy(url);
                  await settle();
                })
              }
            />
          </>
        )}
      </ManagementSection>
      {deleteTarget && bound && (
        <DeleteCommunityDialog
          community={deleteTarget}
          pending={action === "delete"}
          failure={failure}
          close={() => setDeleteTarget(null)}
          onDelete={() => {
            const occupied = readPendingDeletion();
            if (blockedOwner && !occupied) {
              setBlockedOwner(null);
              setError(i18n._(msg`Try again.`));
              return;
            }
            if (blockedOwner || occupied) {
              if (
                occupied?.owner_pubkey === bound &&
                occupied.backend_origin === api.origin()
              ) {
                setPendingDeletion(occupied);
                setError(
                  i18n._(
                    msg`Deletion was not sent. This identity already has a pending deletion request. Use Check deletion status.`,
                  ),
                );
              } else if (occupied) {
                setBlockedOwner(occupied.owner_pubkey);
                setError(
                  occupied.owner_pubkey === bound
                    ? i18n._(
                        msg`Deletion was not sent. This identity has a deletion request saved from a different app address on this device. Contact support before starting another deletion.`,
                      )
                    : i18n._(
                        msg`Deletion was not sent. A deletion request from ${npub(occupied.owner_pubkey)} is already pending on this device.`,
                      ),
                );
              }
              return;
            }
            let pending: PendingDeletion;
            try {
              pending = makePendingDeletion(bound, deleteTarget, api.origin());
              persistPendingDeletion(pending);
            } catch {
              const stored = readPendingDeletion();
              if (
                stored?.owner_pubkey === bound &&
                stored.backend_origin === api.origin()
              )
                setPendingDeletion(stored);
              setError(
                i18n._(
                  msg`Deletion was not sent because its recovery record could not be saved.`,
                ),
              );
              return;
            }
            setPendingDeletion(pending);
            setDeleteTarget(null);
            void run("delete", async () => {
              const at = generation.current;
              await settleDeletion(pending, at, () =>
                api.admitDeletion(pending.request, "fresh"),
              );
            });
          }}
        />
      )}
      {confirm && (
        <AlertDialog
          title={confirm.title}
          description={confirm.description}
          pending={busy}
          initialFocus={confirm.caution ? cancel : proceed}
          onClose={() => setConfirm(null)}
          {...(failure ? { children: failure } : {})}
          actions={
            <>
              <Button
                ref={cancel}
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                {t`Cancel`}
              </Button>
              <Button
                ref={proceed}
                variant={
                  confirm.caution === "permanent" ? "destructive" : "prominent"
                }
                loading={busy}
                onClick={() =>
                  void run("confirm", confirm.run).then(
                    (ok) => ok && setConfirm(null),
                  )
                }
              >
                {confirm.action}
              </Button>
            </>
          }
        />
      )}
      {transfer && (
        <TransferDialog
          name={transfer.name ?? transfer.slug ?? t`this community`}
          busy={busy}
          failure={failure}
          close={() => setTransfer(null)}
          onTransfer={(recipient) =>
            run("transfer", async () => {
              const reply = await api.call("transfer", {
                communityId: transfer.id ?? "",
                transfereeNpub: recipient,
              });
              if (reply.error?.code === "limit_reached")
                throw new ApiFailure(
                  "limit_reached",
                  i18n._(
                    msg`The recipient has reached their community limit.`,
                  ),
                  reply.correlation_id,
                );
              check(reply, i18n._(msg`Could not transfer ownership.`));
              // The community is no longer owned; drop it before refreshing.
              setCommunities((list) =>
                list.filter((item) => item.id !== transfer.id),
              );
              await settle();
            }).then((ok) => ok && setTransfer(null))
          }
        />
      )}
    </section>
  );
}

function DeleteCommunityDialog({
  community,
  pending,
  failure,
  close,
  onDelete,
}: {
  community: Community;
  pending: boolean;
  failure: ReactNode;
  close(): void;
  onDelete(): void;
}) {
  const { t } = useLingui();
  const hostInput = useRef<HTMLInputElement>(null);
  const [host, setHost] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const expected = community.normalized_host ?? "";
  const name = community.name ?? community.slug ?? t`this community`;
  const confirmed = host === expected && acknowledged;
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && close()}
      size="compact"
      initialFocus={hostInput}
      title={t`Permanently delete ${name}?`}
      description={t`This starts an irreversible deletion.`}
      preventClose={pending}
      actions={
        <>
          <Button disabled={pending} onClick={close}>
            {t`Cancel`}
          </Button>
          <Button
            variant="prominent"
            loading={pending}
            disabled={!confirmed || pending}
            onClick={onDelete}
          >
            {t`Start deletion`}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-body-sm">
        <p className="m-0">
          {t`This request cannot be canceled by an owner. All community content will be deleted eventually, the host stays permanently reserved, and your quota slot is released only after logical cleanup finishes.`}
        </p>
        <Field label={t`Type the exact host`}>
          <Input
            ref={hostInput}
            autoComplete="off"
            spellCheck={false}
            value={host}
            onValueChange={setHost}
          />
        </Field>
        <p className="m-0 break-all font-mono">{expected}</p>
        <Checkbox
          checked={acknowledged}
          onCheckedChange={(checked) => setAcknowledged(checked === true)}
          label={t`I understand this cannot be canceled and deletion continues after acceptance.`}
        />
        {failure}
      </div>
    </Dialog>
  );
}

function CreateCommunity({
  open,
  close,
  quotaLabel,
  failure,
  api,
  enabled,
  atLimit,
  busy,
  creating,
  onCreate,
}: {
  open: boolean;
  close(): void;
  quotaLabel: string | null;
  failure: ReactNode;
  api: Api;
  enabled: boolean;
  atLimit: string | null;
  busy: boolean;
  creating: boolean;
  onCreate(name: string): Promise<boolean>;
}) {
  const { i18n, t } = useLingui();
  const formId = useId();
  const addressInput = useRef<HTMLInputElement>(null);
  const deferredFocus = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) deferredFocus.current = null;
    else if (enabled && !busy) {
      // Only finish the opening focus attempt if the user has not moved it.
      if (
        deferredFocus.current &&
        deferredFocus.current === document.activeElement
      )
        addressInput.current?.focus();
      deferredFocus.current = null;
    }
  }, [open, enabled, busy]);
  const availability = useCallback(
    async (name: string) =>
      Boolean(
        check(
          await api.call("availability", { name }),
          i18n._(msg`Could not check that address.`),
        ).available,
      ),
    // i18n 是全局单例，语言切换后随下一次调用生效。
    [api, i18n],
  );
  const address = useCommunityAddress(availability, enabled);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !creating) {
          address.setName("");
          close();
        }
      }}
      size="default"
      headerGap="compact"
      footerGap="compact"
      initialFocus={() => {
        const input = addressInput.current;
        deferredFocus.current = input?.disabled ? document.activeElement : null;
        return input ?? false;
      }}
      preventClose={creating}
      title={t`Create community`}
      description={t`Choose your community’s address.`}
      leadingActions={
        quotaLabel && (
          <p className="m-0 text-body-sm text-muted">{quotaLabel}</p>
        )
      }
      actions={
        <>
          <Button
            variant="subtle"
            disabled={creating}
            onClick={() => {
              address.setName("");
              close();
            }}
          >
            {t`Cancel`}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="prominent"
            aria-label={t`Create community`}
            loading={creating}
            disabled={!address.ready || busy}
          >
            {t`Create`}
          </Button>
        </>
      }
    >
      {failure}
      <form
        id={formId}
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (address.ready)
            void onCreate(address.name).then((ok) => {
              if (ok) {
                address.setName("");
                close();
              }
            });
        }}
      >
        {atLimit && <p className="m-0 text-body-sm text-muted">{atLimit}</p>}
        <CommunityAddressField
          address={address}
          busy={busy}
          inputRef={addressInput}
        />
      </form>
    </Dialog>
  );
}

function TransferDialog({
  name,
  busy,
  failure,
  close,
  onTransfer,
}: {
  name: string;
  busy: boolean;
  failure: ReactNode;
  close(): void;
  onTransfer(npub: string): void;
}) {
  const { t } = useLingui();
  const recipientInput = useRef<HTMLInputElement>(null);
  const [recipient, setRecipient] = useState("");
  const valid = /^npub1[02-9ac-hj-np-z]{58}$/.test(recipient);
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && close()}
      preventClose={busy}
      initialFocus={recipientInput}
      title={t`Transfer ownership`}
      description={t`Transfer ${name} to another person. You become a regular member. The recipient needs a connected Buzz identity first, and this can’t be undone.`}
      actions={
        <>
          <Button disabled={busy} onClick={close}>
            {t`Cancel`}
          </Button>
          <Button
            variant="destructive"
            loading={busy}
            disabled={!valid}
            onClick={() => onTransfer(recipient)}
          >
            {t`Transfer ownership`}
          </Button>
        </>
      }
    >
      <Field
        label={t`Recipient npub`}
        invalid={Boolean(recipient) && !valid}
        error={
          recipient && !valid
            ? t`Enter a valid npub that starts with npub1.`
            : undefined
        }
      >
        <Input
          ref={recipientInput}
          autoComplete="off"
          spellCheck={false}
          placeholder="npub1…"
          value={recipient}
          onValueChange={(value) => setRecipient(value.trim())}
        />
      </Field>
      {failure}
    </Dialog>
  );
}
