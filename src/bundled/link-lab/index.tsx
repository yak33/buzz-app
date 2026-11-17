import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { Field } from "../../shared/design-system/ui/Field";
import { Input } from "../../shared/design-system/ui/Input";
import { useState } from "react";
import type { PluginModule } from "../../plugins/api";
import { InlineLink, linkKind } from "../links/InlineLink";
import styles from "./LinkLab.module.css";

export const inject = ["pages"];
export const apply: PluginModule["apply"] = (ctx) => {
  ctx.pages.register({
    id: "link-lab",
    title: "Link Lab",
    primary: true,
    component: LinkLab,
  });
};

// The Buzz link forms: a channel, a message, and a reply inside a thread.
const general = "buzz://channel/general";
const thread = `buzz://message?channel=general&id=${"2".repeat(64)}&thread=${"2".repeat(64)}`;
const uuidChannel = "buzz://channel/c89a3185-29c5-40db-8284-054536d98b09";
const uuidMessage =
  "buzz://message?channel=c89a3185-29c5-40db-8284-054536d98b09&id=9a77911a6e94147b1ce2cdb3c4e87046c67a29f29f3dd25626134621a5f6924b";

const serviceSamples = [
  ["Figma", "https://www.figma.com/design/example"],
  ["Notion", "https://www.notion.so/example"],
  ["Slack", "https://example.slack.com/archives/example"],
  ["Dropbox", "https://www.dropbox.com/scl/fo/example"],
  ["OneDrive", "https://1drv.ms/f/example"],
  ["GitLab", "https://gitlab.com/example/project"],
  ["YouTube", "https://youtu.be/example"],
  ["Loom", "https://www.loom.com/share/example"],
  ["Zoom", "https://us02web.zoom.us/j/example"],
  ["Teams", "https://teams.microsoft.com/l/meetup-join/example"],
] as const;

function LinkLab() {
  const { i18n, t } = useLingui();
  const [url, setUrl] = useState("https://github.com/block/buzz/pull/1234");
  const [selected, setSelected] = useState(
    t`Select a sample to try its focus and hover states.`,
  );
  const preview = (href: string, label?: string) => (
    <InlineLink
      href={href}
      onClick={(event) => {
        event.preventDefault();
        setSelected(
          i18n._(
            msg`Selected: ${label ?? href}. This preview stays on the page.`,
          ),
        );
      }}
    >
      {label ?? href}
    </InlineLink>
  );
  return (
    <main className={styles.page}>
      <h1 className="text-title">{t`Link Lab`}</h1>
      <p className={styles.intro}>
        {t`Blue text, a soft background on hover, and a little context from the icon.`}
      </p>
      <div className={styles.samples}>
        <section>
          <span className={styles.label}>{t`Web`}</span>
          <p>
            {t`The details are on`}{" "}
            {preview("https://example.com", "example.com")}{" "}
            {t`if you want to take a look.`}
          </p>
        </section>
        <section>
          <span className={styles.label}>{t`GitHub`}</span>
          <p>
            {t`Ready for a look at`}{" "}
            {preview(
              "https://github.com/block/buzz/pull/1234",
              "block/buzz #1234",
            )}
            {t`? The spacing is updated.`}
          </p>
        </section>
        <section>
          <span className={styles.label}>{t`Google Drive`}</span>
          <p>
            {t`Files live in`}{" "}
            {preview(
              "https://drive.google.com/drive/folders/example",
              t`the shared folder`,
            )}
            {t`, including`}{" "}
            {preview(
              "https://docs.google.com/document/d/example/edit",
              t`the project notes`,
            )}
            {t`,`}{" "}
            {preview(
              "https://docs.google.com/spreadsheets/d/example/edit",
              t`the tracker`,
            )}
            {t`, and`}{" "}
            {preview(
              "https://docs.google.com/presentation/d/example/edit",
              t`the slide deck`,
            )}
            {t`.`}
          </p>
        </section>
        <section>
          <span className={styles.label}>{t`More services`}</span>
          <div className={styles.services}>
            {serviceSamples.map(([label, href]) => (
              <span key={href}>{preview(href, label)}</span>
            ))}
          </div>
        </section>
        <section>
          <span className={styles.label}>
            {t`Buzz channels, messages and threads`}
          </span>
          <p>
            {t`Head back to`} {preview(general, "#general")} {t`or pick up`}{" "}
            {preview(thread, t`the design discussion`)}.
          </p>
          <p>
            {t`Bare links show their kind:`} {preview(uuidChannel)},{" "}
            {preview(uuidMessage)}, {t`and`}{" "}
            {preview(`${uuidMessage}&thread=${"2".repeat(64)}`)}.
          </p>
        </section>
        <section>
          <span className={styles.label}>{t`Full URLs and wrapping`}</span>
          <p>
            {t`Here's the reference:`}{" "}
            {preview(
              "https://github.com/block/buzz/issues/1234?view=conversation&filter=design-feedback",
            )}
            {t`. Let me know what you think.`}
          </p>
        </section>
        <section>
          <Field
            label={t`Try a URL`}
            error={
              !linkKind(url)
                ? t`Enter an HTTP, HTTPS, or supported Buzz link.`
                : undefined
            }
          >
            <Input
              id="link-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              spellCheck={false}
            />
          </Field>
          <p>
            {t`Take a look at`} {preview(url)}.
          </p>
        </section>
      </div>
      <p className={styles.status} role="status">
        {selected}
      </p>
    </main>
  );
}
