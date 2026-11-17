// How a pull request's state looks and reads, the same in the sidebar, the
// panel and links in messages, and an issue's in links.
import { msg } from "@lingui/core/macro";
// 本地化服务是全局单例：非组件工具函数在调用时求值（见 lingui.config.ts）。
import { i18n } from "../../features/localization/service";
import {
  CheckCircleIcon,
  CircleDashedIcon,
  GitHubIssueIcon,
  GitMergeIcon,
  GitPullRequestIcon,
  XCircleIcon,
} from "../../shared/design-system/icons/index";
import type { PullState } from "./pull-states";

export const stateIcons = {
  open: GitPullRequestIcon,
  draft: CircleDashedIcon,
  closed: XCircleIcon,
  merged: GitMergeIcon,
};

/** An issue's: one completed is checked off, as on GitHub, and one not
 * planned is crossed out, as a closed pull request is here. */
export const issueIcons = {
  open: GitHubIssueIcon,
  completed: CheckCircleIcon,
  "not planned": XCircleIcon,
};

type Read = Readonly<{
  state?: PullState | undefined;
  /** It could not be read. */
  failed?: boolean | undefined;
}>;

/** The words for what the icon shows. */
export function describePull({ state, failed }: Read) {
  if (failed) return i18n._(msg`Pull request, unavailable`);
  if (!state) return i18n._(msg`Pull request`);
  const notes = [
    state.state === "draft"
      ? i18n._(msg`draft`)
      : i18n._(msg`${state.state}`),
  ];
  if (state.state === "open" || state.state === "draft") {
    if (state.checks === "failure") notes.push(i18n._(msg`checks failing`));
    if (state.checks === "pending") notes.push(i18n._(msg`checks running`));
    if (state.conflicts) notes.push(i18n._(msg`conflicts`));
  }
  return i18n._(msg`Pull request, ${notes.join(", ")}`);
}

/** The tone a pull request shows: its state, or whether an open one needs
 * attention. */
export function pullTone({ state }: Read) {
  if (!state) return "unknown";
  if (state.state !== "open") return state.state;
  if (state.checks === "failure" || state.conflicts) return "failure";
  return state.checks === "pending" ? "pending" : "open";
}

/** What an issue's icon shows: open, or why it was closed. */
export const issueState = (state: PullState) =>
  state.state === "closed" ? (state.reason ?? "completed") : "open";

/** The words for what an issue's icon shows. */
export function describeIssue({ state, failed }: Read) {
  if (failed) return i18n._(msg`Issue, unavailable`);
  if (!state) return i18n._(msg`Issue`);
  const shown = issueState(state);
  return shown === "open"
    ? i18n._(msg`Issue, open`)
    : i18n._(msg`Issue, closed as ${shown}`);
}
