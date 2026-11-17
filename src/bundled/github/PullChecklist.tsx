import { msg } from "@lingui/core/macro";
// 本地化服务是全局单例：模块级辅助函数在调用时求值（见 lingui.config.ts）。
import { i18n } from "../../features/localization/service";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  CaretDownIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CircleDashedIcon,
  DotsThreeIcon,
  GitMergeIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "../../shared/design-system/icons/index";
import { AlertDialog } from "../../shared/design-system/ui/AlertDialog";
import { Button } from "../../shared/design-system/ui/Button";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import {
  MenuItem,
  MenuPopup,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "../../shared/design-system/ui/Menu";
import inlineStyles from "../../shared/InlineReference.module.css";
import { relativeTimestamp } from "../../shared/relative-timestamp";
import type { CheckSummary } from "./checks";
import type { GitHubDetails } from "./data";
import type { GitHubCli } from "./gh";
import { readable } from "./object";
import {
  changePull,
  mergeLabels,
  type MergeMethod,
  type PullAction,
  type PullChecklist as Checklist,
} from "./pull";
import styles from "./GitHub.module.css";

type Tone = "success" | "failure" | "pending" | "neutral";
const toneIcons = {
  success: CheckCircleIcon,
  failure: XCircleIcon,
  pending: WarningCircleIcon,
  neutral: CircleDashedIcon,
};

function Row({
  tone,
  label,
  action,
  details,
  children,
}: {
  tone: Tone;
  label: string;
  action?: ReactNode;
  details?: ReactNode;
  children: ReactNode;
}) {
  const Icon = toneIcons[tone];
  return (
    <li
      className={styles.checklistRow}
      data-tone={tone}
      data-action={!!action || undefined}
    >
      <Icon size={16} aria-hidden="true" />
      <span className={styles.checklistLabel}>{label}</span>
      <div className={styles.checklistContent}>
        <span className={styles.checklistValue}>{children}</span>
        {details}
        {action && <span className={styles.checklistAction}>{action}</span>}
      </div>
    </li>
  );
}

const names = (people: readonly string[]) =>
  people.length > 3
    ? i18n._(
        msg`${people.slice(0, 2).join(", ")} and ${people.length - 2} more`,
      )
    : people.join(", ");

function ChecksRow({
  checks,
  url,
  action,
}: {
  checks: CheckSummary;
  url: string;
  action?: ReactNode;
}) {
  const { t } = useLingui();
  const count = (category: string) =>
    checks.checks?.filter((check) => check.category === category).length ?? 0;
  const failing =
    checks.checks?.filter(
      (check) => check.category === "failing" || check.category === "cancelled",
    ) ?? [];
  const passed = count("successful");
  const running = count("pending");
  const tone: Tone =
    checks.state === "success"
      ? "success"
      : checks.state === "failure"
        ? "failure"
        : checks.state === "pending"
          ? "pending"
          : "neutral";
  const parts = [
    running && t`${running} running`,
    passed && t`${passed} passed`,
    count("skipped") && t`${count("skipped")} skipped`,
  ].filter(Boolean);
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  return (
    <Row
      tone={tone}
      label={t`Checks`}
      action={action}
      details={
        expanded && failing.length > 0 ? (
          <div id={detailsId} className={styles.checklistDetails}>
            <ul aria-label={t`Failed checks`}>
              {failing.map((check) => (
                <li key={check.key}>
                  {check.url ? (
                    <a
                      className={inlineStyles.link}
                      href={check.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {check.name}
                    </a>
                  ) : (
                    check.name
                  )}
                  {check.description && <> — {check.description}</>}
                </li>
              ))}
            </ul>
            <a
              className={inlineStyles.link}
              href={`${url}/checks`}
              target="_blank"
              rel="noreferrer"
            >
              {t`View all checks`}
            </a>
          </div>
        ) : undefined
      }
    >
      {checks.state === "unavailable" && !failing.length ? (
        t`Couldn’t read every check`
      ) : !checks.checks?.length ? (
        t`No checks`
      ) : failing.length ? (
        <Button
          variant="plain"
          size="inline"
          aria-expanded={expanded}
          aria-controls={expanded ? detailsId : undefined}
          onClick={() => setExpanded(!expanded)}
        >
          {[t`${failing.length} failed`, ...parts].join(" · ")}
          {expanded ? (
            <CaretDownIcon size={14} />
          ) : (
            <CaretRightIcon size={14} />
          )}
        </Button>
      ) : !running && passed ? (
        count("skipped") ? (
          t`All ${passed} passed · ${count("skipped")} skipped`
        ) : (
          t`All ${passed} passed`
        )
      ) : (
        parts.join(" · ")
      )}
    </Row>
  );
}

function ReviewRow({ review }: { review: Checklist["review"] }) {
  const { t } = useLingui();
  if (review.decision === "CHANGES_REQUESTED")
    return (
      <Row tone="failure" label={t`Review`}>
        {t`Changes requested by ${names(review.changes)}`}
      </Row>
    );
  // GitHub's decision comes first: an approval can still leave a required
  // review (a code owner, or a second approver) outstanding.
  if (review.decision === "REVIEW_REQUIRED")
    return (
      <Row tone="pending" label={t`Review`}>
        {t`Required`}
        {!!review.approved.length &&
          t` · approved by ${names(review.approved)}`}
        {!!review.waiting.length && t` · waiting on ${names(review.waiting)}`}
      </Row>
    );
  if (review.decision === "APPROVED" || review.approved.length)
    return (
      <Row tone="success" label={t`Review`}>
        {t`Approved by ${names(review.approved)}`}
      </Row>
    );
  return (
    <Row tone="neutral" label={t`Review`}>
      {review.waiting.length
        ? t`Waiting on ${names(review.waiting)}`
        : t`Not required`}
    </Row>
  );
}

function MergeRow({ pull, action }: { pull: Checklist; action?: ReactNode }) {
  const { t } = useLingui();
  const base = <span className={styles.branchLabel}>{pull.base}</span>;
  const [tone, text]: [Tone, ReactNode] = (() => {
    if (pull.queued)
      return [
        "pending",
        <>
          {t`Queued for merge into`} {base}
        </>,
      ];
    switch (pull.merge) {
      case "CLEAN":
      case "HAS_HOOKS":
        return [
          "success",
          <>
            {t`Ready to merge into`} {base}
          </>,
        ];
      case "UNSTABLE":
        return [
          "success",
          <>
            {t`Can merge into`} {base}
            {t`; optional checks failed`}
          </>,
        ];
      case "BLOCKED":
        return [
          "pending",
          <>
            {t`Blocked by`} {base}
            {t`’s rules`}
            {pull.canBypass &&
              !pull.queueRequired &&
              t` · you can bypass them`}
          </>,
        ];
      case "BEHIND":
        return [
          "pending",
          <>
            {t`Behind`} {base}
          </>,
        ];
      case "DIRTY":
        return [
          "failure",
          <>
            {t`Conflicts with`} {base}
          </>,
        ];
      case "DRAFT":
        return ["neutral", t`Draft, so it can’t merge yet`];
      default:
        return ["neutral", t`GitHub is still checking`];
    }
  })();
  return (
    <Row tone={tone} label={t`Merge`} action={action}>
      {text}
    </Row>
  );
}

/** Whether the merge button can merge now, and whether that bypasses rules. */
function mergeability(pull: Checklist) {
  if (pull.state !== "open" || pull.queued)
    return { now: false, bypass: false };
  // A queue-required branch can report BLOCKED until enqueued; GitHub
  // validates its prerequisites when accepting the enqueue request.
  if (pull.queueRequired)
    return {
      now: ["CLEAN", "HAS_HOOKS", "UNSTABLE", "BLOCKED", "BEHIND"].includes(
        pull.merge,
      ),
      bypass: false,
    };
  if (["CLEAN", "HAS_HOOKS", "UNSTABLE"].includes(pull.merge))
    return { now: true, bypass: false };
  if (["BLOCKED", "BEHIND"].includes(pull.merge) && pull.canBypass)
    return { now: true, bypass: true };
  return { now: false, bypass: false };
}

function Actions({
  pull,
  number,
  title,
  gh,
  refresh,
}: {
  pull: Checklist;
  number: string;
  title: string;
  gh: GitHubCli;
  refresh(): Promise<void>;
}) {
  const { i18n, t } = useLingui();
  const [busy, setBusy] = useState<PullAction["type"]>();
  const [error, setError] = useState<string>();
  // What the merge was confirmed against. A refresh that brings a newer push,
  // a new base branch, or a change in whether the merge bypasses branch rules
  // closes the dialog, and the merge itself names the confirmed head.
  const [asked, setConfirming] =
    useState<
      Readonly<{
        method: MergeMethod;
        head: string;
        base: string;
        bypass: boolean;
        queue: boolean;
      }>
    >();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function run(action: PullAction, head = pull.head) {
    setBusy(action.type);
    setError(undefined);
    try {
      await changePull(gh, { id: pull.id, head }, action);
      await refresh();
      if (alive.current) setConfirming(undefined);
    } catch (failure) {
      if (alive.current) setError(readable(failure).message);
    } finally {
      if (alive.current) setBusy(undefined);
    }
  }
  const merge = mergeability(pull);
  // A new confirmation starts without an earlier action's error.
  const confirm = (method: MergeMethod) => {
    setError(undefined);
    setConfirming({
      method,
      head: pull.head,
      base: pull.base,
      bypass: merge.bypass,
      queue: pull.queueRequired,
    });
  };
  const confirming =
    merge.now &&
    asked?.head === pull.head &&
    asked.base === pull.base &&
    asked.bypass === merge.bypass &&
    asked.queue === pull.queueRequired
      ? asked
      : undefined;
  // Forgotten during render, so changing back does not reopen it.
  if (asked && !confirming) setConfirming(undefined);
  // 先求标签再套模板：t`` 插值里不能嵌套 i18n._。
  const confirmAction = confirming
    ? confirming.queue
      ? t`Queue for merge`
      : i18n._(mergeLabels[confirming.method])
    : undefined;
  const canAutoMerge =
    !pull.queueRequired &&
    !pull.queued &&
    pull.canEnableAutoMerge &&
    !pull.autoMerge &&
    pull.state === "open" &&
    !["CLEAN", "HAS_HOOKS", "DIRTY"].includes(pull.merge);
  const others =
    pull.queueRequired || pull.queued
      ? []
      : pull.methods.filter((method) => method !== pull.method);
  const menu = [
    ...(merge.now
      ? others.map((method) => (
          <MenuItem key={method} onClick={() => confirm(method)}>
            {i18n._(mergeLabels[method])}
          </MenuItem>
        ))
      : []),
    ...(canAutoMerge && merge.now
      ? [
          <MenuItem
            key="auto"
            onClick={() =>
              void run({ type: "auto-merge", method: pull.method })
            }
          >
            {t`Merge automatically when ready`}
          </MenuItem>,
        ]
      : []),
    ...(pull.state === "open" && pull.canUpdate
      ? [
          ...(merge.now || canAutoMerge ? [<MenuSeparator key="split" />] : []),
          <MenuItem key="draft" onClick={() => void run({ type: "draft" })}>
            {t`Convert to draft`}
          </MenuItem>,
        ]
      : []),
  ];
  return (
    <>
      <div className={styles.pullActions}>
        {pull.state === "draft" && pull.canUpdate && (
          <Button
            variant="prominent"
            size="sm"
            loading={busy === "ready"}
            disabled={!!busy}
            onClick={() => void run({ type: "ready" })}
          >
            {t`Ready for review`}
          </Button>
        )}
        {pull.queued ? (
          <span className={styles.pullActionNote}>{t`Queued for merge`}</span>
        ) : pull.autoMerge ? (
          <>
            <span className={styles.pullActionNote}>
              {t`Merges automatically when ready`}
              {pull.autoMerge.by && t` · set by ${pull.autoMerge.by}`}
            </span>
            {pull.canDisableAutoMerge && (
              <Button
                size="sm"
                loading={busy === "cancel-auto-merge"}
                disabled={!!busy}
                onClick={() => void run({ type: "cancel-auto-merge" })}
              >
                {t`Cancel`}
              </Button>
            )}
          </>
        ) : merge.now ? (
          <Button
            variant={merge.bypass ? "attention" : "prominent"}
            size="sm"
            disabled={!!busy}
            onClick={() => confirm(pull.method)}
          >
            {pull.queueRequired
              ? t`Queue for merge`
              : i18n._(mergeLabels[pull.method])}
          </Button>
        ) : (
          canAutoMerge && (
            <Button
              variant="prominent"
              size="sm"
              loading={busy === "auto-merge"}
              disabled={!!busy}
              onClick={() =>
                void run({ type: "auto-merge", method: pull.method })
              }
            >
              {t`Merge when ready`}
            </Button>
          )
        )}
        {pull.merge === "BEHIND" && pull.canUpdateBranch && (
          <Button
            size="sm"
            loading={busy === "update-branch"}
            disabled={!!busy}
            onClick={() => void run({ type: "update-branch" })}
          >
            {t`Update branch`}
          </Button>
        )}
        {!!menu.length && (
          <MenuRoot>
            <MenuTrigger
              render={
                <IconButton
                  aria-label={t`More pull request actions`}
                  size="sm"
                  icon={<DotsThreeIcon />}
                  disabled={!!busy}
                />
              }
            />
            <MenuPopup align="end">{menu}</MenuPopup>
          </MenuRoot>
        )}
      </div>
      {error && !confirming && (
        <p role="alert" className={styles.pullActionError}>
          {error}
        </p>
      )}
      {confirming && (
        <AlertDialog
          title={t`${confirmAction} #${number}?`}
          description={
            confirming.queue
              ? t`${title}, into ${pull.base} at the commit shown here. GitHub will merge it through the queue once the required checks pass.`
              : confirming.bypass
                ? t`${title}. This bypasses ${pull.base}’s branch rules, which haven’t all passed.`
                : t`${title}, into ${pull.base} at the commit shown here.`
          }
          pending={busy === "merge" || busy === "enqueue"}
          onClose={() => {
            setConfirming(undefined);
            setError(undefined);
          }}
          actions={
            <>
              <Button
                disabled={busy === "merge" || busy === "enqueue"}
                onClick={() => {
                  setConfirming(undefined);
                  setError(undefined);
                }}
              >
                {t`Cancel`}
              </Button>
              <Button
                variant={confirming.bypass ? "attention" : "prominent"}
                loading={busy === "merge" || busy === "enqueue"}
                onClick={() =>
                  void run(
                    confirming.queue
                      ? { type: "enqueue" }
                      : { type: "merge", method: confirming.method },
                    confirming.head,
                  )
                }
              >
                {confirming.queue ? t`Queue for merge` : t`Merge`}
              </Button>
            </>
          }
        >
          {error && (
            <p role="alert" className={styles.pullActionError}>
              {error}
            </p>
          )}
        </AlertDialog>
      )}
    </>
  );
}

/** The pull request's state as a short checklist, with the actions that
 * move it on: what someone needs when their agents read the details. */
export function PullChecklist({
  url,
  details,
  checklist,
  gh,
  refresh,
  resolveAction,
}: {
  url: string;
  details: GitHubDetails;
  checklist: Checklist;
  gh: GitHubCli;
  refresh(): Promise<void>;
  resolveAction?: ((action: "failures" | "conflicts") => ReactNode) | undefined;
}) {
  const { t } = useLingui();
  if (checklist.state === "merged" || checklist.state === "closed")
    return (
      <ul className={styles.checklist} aria-label={t`Pull request state`}>
        {checklist.state === "merged" ? (
          <li className={styles.checklistRow} data-tone="merged">
            <GitMergeIcon size={16} aria-hidden="true" />
            <span className={styles.checklistValue}>
              {t`Merged into`}{" "}
              <span className={styles.branchLabel}>{checklist.base}</span>
              {details.mergedBy && t` by ${details.mergedBy}`}
              {details.mergedAt &&
                t` ${relativeTimestamp(Date.parse(details.mergedAt) / 1000)}`}
            </span>
          </li>
        ) : (
          <Row tone="neutral" label={t`Closed`}>
            {t`Without merging`}
          </Row>
        )}
      </ul>
    );
  return (
    <>
      <ul className={styles.checklist} aria-label={t`Pull request checklist`}>
        <ChecksRow
          checks={checklist.checks}
          url={url}
          action={
            checklist.checks.state === "failure" ||
            checklist.checks.checks?.some((check) =>
              ["failing", "cancelled"].includes(check.category),
            )
              ? resolveAction?.("failures")
              : undefined
          }
        />
        <ReviewRow review={checklist.review} />
        <Row
          tone={
            checklist.unresolved || checklist.moreThreads
              ? "pending"
              : "success"
          }
          label={t`Threads`}
        >
          {checklist.unresolved || checklist.moreThreads ? (
            <a
              className={inlineStyles.link}
              href={`${url}/files`}
              target="_blank"
              rel="noreferrer"
            >
              {checklist.moreThreads
                ? t`${checklist.unresolved} unresolved in the latest 100`
                : t`${checklist.unresolved} unresolved`}
            </a>
          ) : (
            t`None unresolved`
          )}
        </Row>
        <MergeRow
          pull={checklist}
          action={
            checklist.merge === "DIRTY"
              ? resolveAction?.("conflicts")
              : undefined
          }
        />
      </ul>
      <Actions
        pull={checklist}
        number={url.split("/").at(-1) ?? ""}
        title={details.title}
        gh={gh}
        refresh={refresh}
      />
    </>
  );
}

/** Without `gh`, only CI can be read for the checklist, from the public API,
 * as the store reads the rest of the pull request. */
export function PublicChecklist({
  url,
  sha,
  checks,
}: {
  url: string;
  sha: string | undefined;
  checks: CheckSummary | undefined;
}) {
  const { t } = useLingui();
  return (
    <ul className={styles.checklist} aria-label={t`Pull request checklist`}>
      {checks ? (
        <ChecksRow checks={checks} url={url} />
      ) : (
        <Row tone="neutral" label={t`Checks`}>
          {sha ? t`Loading…` : t`Unavailable`}
        </Row>
      )}
    </ul>
  );
}
