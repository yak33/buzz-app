import { useLingui } from "@lingui/react/macro";
import { Header } from "../../shared/design-system/ui/Header";
import { AuthorSettings } from "./AuthorSettings";
import type { GitHubCli } from "./gh";
import { LinkSettings } from "./LinkSettings";

export function GitHubSettings({
  active,
  gh,
}: {
  active(): boolean;
  gh?: GitHubCli | undefined;
}) {
  const { t } = useLingui();
  return (
    <section aria-label={t`GitHub settings`}>
      <Header title={t`GitHub`} />
      <div className="grid grid-cols-1 gap-section-gap">
        <LinkSettings active={active} />
        <AuthorSettings active={active} gh={gh} />
      </div>
    </section>
  );
}
