import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ChannelMessage } from "../features/relay/contracts";
import {
  isolateLanguageValue,
  LANGUAGE_VALUE_MARKER,
} from "../features/localization/LanguageBoundary";
import type { PluginManager } from "../plugins/manager";
import type { PluginRequest } from "../plugins/requests";
import { Button } from "../shared/design-system/ui/Button";
import { REQUEST_VERB, RequestReview } from "./AgentPluginRequests";
import styles from "./PluginRequestCard.module.css";

type Authorize = NonNullable<
  Parameters<typeof RequestReview>[0]["authorizeGit"]
>;
const DONE = {
  install: msg`Installed`,
  update: msg`Updated`,
  enable: msg`Enabled`,
  remove: msg`Deleted`,
} satisfies Record<PluginRequest["action"], ReturnType<typeof msg>>;

/** An agent's plugin request, in the conversation it asked from. The owner
 * reviews it here when this device holds the request; elsewhere, or after the
 * app restarts, the message is all that is left of it. */
export function PluginRequestCard({
  message,
  plugins,
  authorizeGit,
  holdReview,
}: {
  message: ChannelMessage;
  plugins: PluginManager;
  authorizeGit?: Authorize | undefined;
  holdReview?: (() => () => void) | undefined;
}) {
  const { i18n, t } = useLingui();
  const titleId = useId();
  const { requests } = plugins;
  const id = message.pluginRequest?.id ?? "";
  const waiting = useSyncExternalStore(requests.subscribe, () =>
    requests.pending().find((item) => item.id === id),
  );
  const decided = useSyncExternalStore(requests.subscribe, () =>
    requests.decided(id),
  );
  const { configuration, busy } = useSyncExternalStore(
    plugins.subscribe,
    plugins.snapshot,
  );
  // Held, not looked up, so settling the request never remounts the review.
  const [reviewing, setReviewing] = useState<PluginRequest>();
  const trigger = useRef<HTMLElement | null>(null);
  const outcome = useRef<HTMLSpanElement>(null);
  const declining = useRef(false);
  // Settling removes the button that had focus; the outcome replaces it.
  useEffect(() => {
    const opener = trigger.current;
    const lost =
      !!opener &&
      !opener.isConnected &&
      document.activeElement === document.body;
    if (!declining.current && !lost) return;
    declining.current = false;
    trigger.current = null;
    outcome.current?.focus();
  });
  // Anyone can write the tag; only the agent that asked can claim the request.
  const request = [waiting, decided].find(
    (item) => item?.requester.pubkey === message.authorId,
  );
  if (!request)
    return (
      <section
        lang={i18n.locale}
        aria-label={t`Plugin request`}
        className={styles.card}
      >
        <div className={styles.details}>
          <span lang="" className={styles.reason}>
            {message.content}
          </span>
          <span lang={i18n.locale} className="text-secondary">
            {t`No longer available on this device.`}
          </span>
        </div>
      </section>
    );
  const name = request.pluginName;
  return (
    <>
      <section
        lang={i18n.locale}
        aria-labelledby={titleId}
        className={styles.card}
      >
        <div className={styles.details}>
          <strong id={titleId}>
            {isolateLanguageValue(
              i18n._(REQUEST_VERB[request.action](LANGUAGE_VALUE_MARKER)),
              name,
            )}
          </strong>
          <span lang="" className={`${styles.reason} text-secondary`}>
            {request.requester.name}: {request.reason}
          </span>
        </div>
        <div className={styles.actions}>
          {waiting ? (
            <>
              <Button
                size="sm"
                variant="subtle"
                lang={i18n.locale}
                aria-labelledby={`${titleId}-decline`}
                onClick={() => {
                  declining.current = true;
                  requests.settle(waiting.id, "declined");
                }}
              >
                <span aria-hidden="true">{t`Decline`}</span>
                <span id={`${titleId}-decline`} className="sr-only">
                  {isolateLanguageValue(
                    t`Decline ${LANGUAGE_VALUE_MARKER}`,
                    name,
                  )}
                </span>
              </Button>
              <Button
                size="sm"
                variant="prominent"
                disabled={busy || configuration.status !== "ready"}
                lang={i18n.locale}
                aria-labelledby={`${titleId}-review`}
                onClick={(event) => {
                  trigger.current = event.currentTarget;
                  setReviewing(waiting);
                }}
              >
                <span aria-hidden="true">{t`Review`}</span>
                <span id={`${titleId}-review`} className="sr-only">
                  {isolateLanguageValue(
                    t`Review ${LANGUAGE_VALUE_MARKER}`,
                    name,
                  )}
                </span>
              </Button>
            </>
          ) : (
            <span
              ref={outcome}
              tabIndex={-1}
              role="status"
              lang={i18n.locale}
              className="text-secondary"
            >
              {decided?.state === "approved"
                ? i18n._(DONE[request.action])
                : t`Declined`}
            </span>
          )}
        </div>
      </section>
      {reviewing && configuration.status === "ready" && (
        <RequestReview
          plugins={plugins}
          catalog={configuration.catalog}
          busy={busy}
          request={reviewing}
          authorizeGit={authorizeGit}
          holdReview={holdReview}
          returnFocus={() => outcome.current ?? trigger.current}
          onClose={() => setReviewing(undefined)}
        />
      )}
    </>
  );
}
