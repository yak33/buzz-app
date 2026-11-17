import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useRef, useState } from "react";
import { CaretDownIcon } from "../../shared/design-system/icons/index";
import { Button } from "../../shared/design-system/ui/Button";
import { Field } from "../../shared/design-system/ui/Field";
import {
  PopoverPopup,
  PopoverRoot,
  PopoverTrigger,
} from "../../shared/design-system/ui/Popover";
import { Radio, RadioGroup } from "../../shared/design-system/ui/RadioGroup";
import { Textarea } from "../../shared/design-system/ui/Textarea";
import { useToastNotification } from "../../shared/design-system/ui/Toast";
import type { GitHubCli } from "./gh";
import { readable } from "./object";
import { changePull, type PullChecklist, type ReviewEvent } from "./pull";
import type { PanelMemory, ReviewDraft } from "./panel-memory";
import styles from "./GitHub.module.css";

/** 决定项的标签与说明是 Lingui descriptor，由渲染处求值。 */
const decisions: readonly (readonly [
  ReviewEvent,
  MessageDescriptor,
  MessageDescriptor,
])[] = [
  ["COMMENT", msg`Comment`, msg`Share feedback without approving`],
  ["APPROVE", msg`Approve`, msg`Approve merging these changes`],
  [
    "REQUEST_CHANGES",
    msg`Request changes`,
    msg`Ask for changes before merging`,
  ],
];

/** A review is worth keeping once it has text; a decision alone is a click
 * away, and a submitted review leaves none. */
const isEmptyDraft = (body: string) => !body.trim();

const sameDraft = (a: ReviewDraft, b: ReviewDraft) =>
  a.event === b.event && a.body === b.body && a.head === b.head;

/** Reviews someone else's pull request. The draft outlasts dismissing the
 * popover, as GitHub's does, and the panel, in the plugin's memory; it clears
 * once the review is in. */
export function SubmitReview({
  pull,
  url,
  gh,
  refresh,
  memory,
}: {
  pull: PullChecklist;
  url: string;
  gh: GitHubCli;
  refresh(): Promise<void>;
  memory: PanelMemory;
}) {
  const { i18n, t } = useLingui();
  const [open, setOpen] = useState(false);
  const remembered = memory.get(url).review;
  // The head the draft is written against. As with the merge confirmation, a
  // newer push needs the person's say-so before the review goes in.
  const [head, setHead] = useState(remembered?.head ?? pull.head);
  const [event, setEvent] = useState<ReviewEvent>(
    remembered?.event ?? "COMMENT",
  );
  const [body, setBody] = useState(remembered?.body ?? "");
  const notify = useToastNotification();
  const [busy, setBusy] = useState(false);
  // Memory follows the person's edits only. Submit takes the draft out while
  // it goes in, and its reset or recovery writes nothing back: another panel
  // on this pull request may have written a newer draft meanwhile.
  function edit(change: Partial<ReviewDraft>) {
    const draft = { event, body, head, ...change };
    setEvent(draft.event);
    setBody(draft.body);
    setHead(draft.head);
    memory.setReview(url, isEmptyDraft(draft.body) ? undefined : draft);
  }
  const [error, setError] = useState<string>();
  const comment = useRef<HTMLTextAreaElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // GitHub refuses Comment and Request changes reviews without text.
  const ready = event === "APPROVE" || !!body.trim();
  const pushed = head !== pull.head;
  async function submit() {
    if (busy || !ready || pushed) return;
    setBusy(true);
    setError(undefined);
    // Out of memory while it goes in, so no other panel on this pull request
    // offers it again, even one opened before GitHub answers. A different
    // draft there is another panel's, written since this one was, as when a
    // refused review is retried unedited; it stays.
    const draft = { event, body, head };
    const saved = memory.get(url).review;
    if (!saved || sameDraft(saved, draft)) memory.setReview(url, undefined);
    try {
      await changePull(
        gh,
        { id: pull.id, head },
        { type: "review", event, body },
      );
      if (alive.current) await refresh();
      if (alive.current) {
        setOpen(false);
        setEvent("COMMENT");
        setBody("");
        notify(i18n._(msg`Review submitted`), "success");
      }
    } catch (failure) {
      // Back for the next panel, unless another panel has started a draft
      // since; this panel keeps showing it either way.
      if (!isEmptyDraft(body) && !memory.get(url).review)
        memory.setReview(url, draft);
      if (alive.current) setError(readable(failure).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  // A review that is open when the pull request merges or closes keeps its
  // draft; GitHub decides whether it still goes in.
  if (!open && pull.state !== "open" && pull.state !== "draft") return null;
  return (
    <PopoverRoot
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (next) {
          setError(undefined);
          // Closed, the draft is memory's: another panel on this pull request
          // may have changed it, or sent it. A decision without text stays,
          // and only an empty Comment follows a newer push unasked.
          const saved = memory.get(url).review;
          if (saved) {
            setEvent(saved.event);
            setBody(saved.body);
            setHead(saved.head);
          } else if (!isEmptyDraft(body)) {
            setEvent("COMMENT");
            setBody("");
            setHead(pull.head);
          } else if (event === "COMMENT") setHead(pull.head);
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button size="sm">
            {t`Submit review`}
            <CaretDownIcon size="1rem" />
          </Button>
        }
      />
      <PopoverPopup
        align="end"
        size="wide"
        aria-label={t`Submit review`}
        initialFocus={comment}
      >
        <form
          className={styles.review}
          onSubmit={(submitted) => {
            submitted.preventDefault();
            void submit();
          }}
        >
          <Field label={t`Review decision`} nativeLabel={false}>
            <RadioGroup<ReviewEvent>
              name="review-decision"
              value={event}
              disabled={busy}
              onValueChange={(next) => edit({ event: next })}
            >
              {decisions.map(([value, label, description]) => (
                <Radio
                  key={value}
                  value={value}
                  label={i18n._(label)}
                  description={i18n._(description)}
                />
              ))}
            </RadioGroup>
          </Field>
          <Field
            label={t`Review comment`}
            optional={event === "APPROVE"}
            description={
              event === "APPROVE" ? undefined : t`Required unless you approve.`
            }
          >
            <Textarea
              ref={comment}
              rows={4}
              aria-required={event !== "APPROVE"}
              value={body}
              disabled={busy}
              onChange={(change) => edit({ body: change.target.value })}
            />
          </Field>
          {pushed ? (
            <div className={styles.reviewNotice}>
              <p role="status">
                {t`New commits were pushed after you started this review.`}
              </p>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => edit({ head: pull.head })}
              >
                {t`Use latest commit`}
              </Button>
            </div>
          ) : (
            (pull.state === "merged" || pull.state === "closed") && (
              <p role="status">{t`This pull request ${pull.state}.`}</p>
            )
          )}
          {error && (
            <p role="alert" className={styles.pullActionError}>
              {error}
            </p>
          )}
          <div className={styles.reviewActions}>
            <Button disabled={busy} onClick={() => setOpen(false)}>
              {t`Cancel`}
            </Button>
            <Button
              variant="prominent"
              type="submit"
              loading={busy}
              disabled={!ready || pushed}
              focusableWhenDisabled
            >
              {t`Submit review`}
            </Button>
          </div>
        </form>
      </PopoverPopup>
    </PopoverRoot>
  );
}
