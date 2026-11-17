// How a pull request watch looks in Agent Attention.
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
// 本地化服务是全局单例：present 回调在组件渲染外求值（见 lingui.config.ts）。
import { i18n } from "../../features/localization/service";
import { GitPullRequestIcon } from "../../shared/design-system/icons";
import { Button } from "../../shared/design-system/ui/Button";
import type { AttentionSource } from "../../features/agents/attention-sources";
import type { Navigation } from "../../features/navigation/controller";
import { pullOf } from "./watch";

/** Names the pull request a watch follows, and opens the settings for whose
 * feedback wakes agents. */
export function presentPull(
  navigation: Pick<Navigation, "open">,
): NonNullable<AttentionSource["present"]> {
  const Authors = () => {
    const { t } = useLingui();
    return (
      <Button
        variant="link"
        size="inline"
        type="button"
        onClick={() =>
          void navigation.open({
            version: 1,
            kind: "settings",
            section: "buzz.github/authors",
          })
        }
      >
        {t`Choose who can wake agents`}
      </Button>
    );
  };
  return (watch, title) => {
    const pull =
      typeof watch.config.pr === "string" ? pullOf(watch.config.pr) : undefined;
    if (!pull) return { type: "GitHub PR", icon: GitPullRequestIcon };
    return {
      type: "GitHub PR",
      icon: GitPullRequestIcon,
      target: `${pull.name}#${pull.number}`,
      subtitle: title.replace(/^(?:PR\s+\d+:?\s*|[^ ]*#\d+\s*)/i, ""),
      link: { href: pull.url, title: i18n._(msg`Open on GitHub`) },
      details: Authors,
    };
  };
}
