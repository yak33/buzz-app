import { useLingui } from "@lingui/react/macro";
import { useEffect, useState } from "react";
import { Accordion } from "../../shared/design-system/ui/Accordion";
import { Button } from "../../shared/design-system/ui/Button";
import { Field } from "../../shared/design-system/ui/Field";
import { InlineHeader } from "../../shared/design-system/ui/Header";
import { Select } from "../../shared/design-system/ui/Select";
import { SettingsGroup } from "../../shared/design-system/ui/SettingsGroup";
import { Textarea } from "../../shared/design-system/ui/Textarea";
import { loadPolicy, open, parse, savePolicy, type Rule } from "./authors";
import type { GitHubCli } from "./gh";

/** Whose pull request comments and reviews wake agents watching it. */
export function AuthorSettings({
  active,
  gh,
}: {
  active(): boolean;
  gh?: GitHubCli | undefined;
}) {
  const { t } = useLingui();
  const [saved, setSaved] = useState(loadPolicy);
  const [draft, setDraft] = useState(saved.text);
  const [fallback, setFallback] = useState(saved.fallback);
  /** Why the rules could not be saved, apart from why they are not rules. */
  const [error, setError] = useState("");
  // After a Save, each edit checks the rules again.
  const [checked, setChecked] = useState(saved.error !== undefined);
  const parsed = parse(draft);
  const dirty =
    typeof parsed === "string" ||
    parsed.text !== saved.text ||
    fallback !== saved.fallback;
  return (
    <section aria-label={t`GitHub comment authors settings`}>
      <InlineHeader
        title={t`Comment authors`}
        subtitle={t`Agents watching a pull request are woken by CI, and by the comments and reviews these rules allow.`}
      />
      <form
        aria-label={t`GitHub comment author rules`}
        onSubmit={(event) => {
          event.preventDefault();
          if (!active() || !dirty) return;
          setChecked(true);
          if (typeof parsed === "string") return;
          try {
            const policy = savePolicy(draft, fallback);
            setSaved(policy);
            setDraft(policy.text);
            setChecked(false);
            setError("");
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
          }
        }}
      >
        <SettingsGroup layout="form">
          <Account gh={gh} />
          {saved.error !== undefined && (
            <p role="status" className="m-0 text-body-sm text-subtle">
              {t`Your saved rules no longer parse, so no comment or review wakes your agents until you fix them.`}
            </p>
          )}
          {open(saved) && (
            <p role="status" className="m-0 text-body-sm text-subtle">
              {t`Comments from anyone no rule denies can wake your agents.`}
            </p>
          )}
          <Field
            label={t`Rules`}
            error={checked && typeof parsed === "string" ? parsed : undefined}
            description={t`One rule per line. The first rule that matches decides.`}
          >
            <Textarea
              rows={6}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="off"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
            />
          </Field>
          <Accordion
            variant="form"
            items={[
              {
                value: "syntax",
                title: t`Rule syntax`,
                content: (
                  <ul className="m-0 flex flex-col gap-1 pl-5 text-body-sm text-subtle">
                    <li>
                      {t`allow or deny, then any of author:login, author:/pattern/, org:organization, body:/pattern/ and prefix:text, which runs to the end of the line. A bare allow or deny matches everyone.`}
                    </li>
                    <li>
                      {t`author:@me is your GitHub account, a bot’s login ends in [bot], and logins match case aside.`}
                    </li>
                    <li>
                      {t`body: sees a comment’s first 1,000 characters, the most a wake quotes.`}
                    </li>
                    <li>
                      {t`Patterns are JavaScript regular expressions without backreferences, lookaround or escapes JavaScript reads as plain letters, such as \q.`}
                    </li>
                    <li>
                      {t`Membership your GitHub account cannot see, or of a misspelled organization, counts as none.`}
                    </li>
                  </ul>
                ),
              },
            ]}
          />
          <Select
            label={t`When no rule matches`}
            value={fallback}
            groups={[
              {
                label: "",
                options: [
                  { value: "allow", label: t`Wake the agent` },
                  { value: "deny", label: t`Don’t wake it` },
                ],
              },
            ]}
            onValueChange={(value) => setFallback(value as Rule["effect"])}
          />
          {error && (
            <p role="alert" className="m-0 text-body-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button type="submit" variant="primary" disabled={!dirty}>
              {t`Save`}
            </Button>
          </div>
        </SettingsGroup>
      </form>
    </section>
  );
}
/** Who author:@me is: the account the person's `gh` is signed in to. */
function Account({ gh }: { gh: GitHubCli | undefined }) {
  const { t } = useLingui();
  /** The login, or why `gh` could not say. */
  const [answer, setAnswer] = useState<{ login: string } | Error>();
  useEffect(() => {
    if (!gh) return;
    const stop = new AbortController();
    gh<{ viewer: { login: string } }>(
      "query{viewer{login}}",
      {},
      stop.signal,
    ).then(
      ({ viewer }) => setAnswer(viewer),
      (reason) => {
        if (!stop.signal.aborted)
          setAnswer(reason instanceof Error ? reason : Error(String(reason)));
      },
    );
    return () => stop.abort();
  }, [gh]);
  return (
    <p className="m-0 text-body-sm text-subtle">
      {!gh
        ? t`Your GitHub account is the one gh is signed in to in the desktop app.`
        : !answer
          ? t`Checking which GitHub account gh is signed in to…`
          : answer instanceof Error
            ? t`gh couldn’t read your GitHub account: ${answer.message}`
            : t`Signed in to GitHub as ${answer.login} through gh.`}
    </p>
  );
}
