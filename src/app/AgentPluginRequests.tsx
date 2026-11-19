import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertDialog } from "../shared/design-system/ui/AlertDialog";
import { Button } from "../shared/design-system/ui/Button";
import { Dialog } from "../shared/design-system/ui/Dialog";
import { InlineHeader } from "../shared/design-system/ui/Header";
import { PreferenceRow } from "../shared/design-system/ui/PreferenceRow";
import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import {
  isolateLanguageValue,
  LANGUAGE_VALUE_MARKER,
} from "../features/localization/LanguageBoundary";
import type { PluginManager } from "../plugins/manager";
import type { PluginRequest } from "../plugins/requests";
import type { Catalog } from "../plugins/types";
import { ManagedPluginReview } from "./ManagedPlugins";
import { PluginAccessReview } from "./PluginAccessReview";
import styles from "./Settings.module.css";

type Authorize = NonNullable<
  Parameters<typeof ManagedPluginReview>[0]["authorizeGit"]
>;

export const REQUEST_VERB: Record<
  PluginRequest["action"],
  (name: string) => MessageDescriptor
> = {
  install: (name) => msg`Install ${name}`,
  update: (name) => msg`Update ${name}`,
  enable: (name) => msg`Enable ${name}`,
  remove: (name) => msg`Delete ${name}`,
};

/** Plugin changes agents asked for. Each applies only through the same
 * review a person's own install uses. */
export function AgentPluginRequests({
  plugins,
  catalog,
  busy,
  authorizeGit,
  holdReview,
  fallbackFocus,
}: {
  plugins: PluginManager;
  catalog: Catalog;
  busy: boolean;
  authorizeGit?: Authorize | undefined;
  /** Refuses plugin install requests while a review is open. */
  holdReview?: (() => () => void) | undefined;
  /** Where focus goes once no request remains. */
  fallbackFocus?: (() => HTMLElement | null) | undefined;
}) {
  const { i18n, t } = useLingui();
  const { requests } = plugins;
  const pending = useSyncExternalStore(requests.subscribe, requests.pending);
  // Held, not looked up, so settling the request never remounts the review.
  const [reviewing, setReviewing] = useState<PluginRequest>();
  const trigger = useRef<HTMLElement | null>(null);
  const section = useRef<HTMLElement>(null);
  // A settled request's buttons are gone, so focus moves to what survives.
  const survivor = () =>
    (requests.pending().length ? section.current : fallbackFocus?.()) ?? null;
  // The request the owner approved removes its Review button; when focus fell
  // with it, move it to what survives.
  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs when the pending requests change.
  useEffect(() => {
    if (!trigger.current || trigger.current.isConnected) return;
    trigger.current = null;
    if (document.activeElement === document.body) survivor()?.focus();
  }, [pending]);
  const review = reviewing && (
    <RequestReview
      plugins={plugins}
      catalog={catalog}
      busy={busy}
      request={reviewing}
      authorizeGit={authorizeGit}
      holdReview={holdReview}
      returnFocus={() =>
        requests.pending().includes(reviewing) ? trigger.current : survivor()
      }
      onClose={() => setReviewing(undefined)}
    />
  );
  return (
    <>
      {pending.length > 0 && (
        <section
          ref={section}
          tabIndex={-1}
          aria-labelledby="agent-plugin-requests-title"
          className={styles.pluginCoreSection}
        >
          <InlineHeader
            id="agent-plugin-requests-title"
            title={<span lang={i18n.locale}>{t`Requested by agents`}</span>}
          />
          <SettingsGroup>
            {pending.map((request) => (
              <PreferenceRow
                key={request.id}
                title={
                  <span lang={i18n.locale}>
                    {isolateLanguageValue(
                      i18n._(
                        REQUEST_VERB[request.action](LANGUAGE_VALUE_MARKER),
                      ),
                      request.pluginName,
                    )}
                  </span>
                }
                subtitle={
                  <span lang="">
                    {request.requester.name}: {request.reason}
                  </span>
                }
                trailing={(label) => {
                  const declineLabelId = `${label["aria-labelledby"]}-${request.id}-decline`;
                  const reviewLabelId = `${label["aria-labelledby"]}-${request.id}-review`;
                  return (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="subtle"
                        lang={i18n.locale}
                        aria-labelledby={declineLabelId}
                        onClick={() => {
                          requests.settle(request.id, "declined");
                          survivor()?.focus();
                        }}
                      >
                        <span aria-hidden="true">{t`Decline`}</span>
                        <span id={declineLabelId} className="sr-only">
                          {isolateLanguageValue(
                            t`Decline ${LANGUAGE_VALUE_MARKER}`,
                            request.pluginName,
                          )}
                        </span>
                      </Button>
                      <Button
                        size="sm"
                        variant="prominent"
                        disabled={busy}
                        lang={i18n.locale}
                        aria-labelledby={reviewLabelId}
                        onClick={(event) => {
                          trigger.current = event.currentTarget;
                          setReviewing(request);
                        }}
                      >
                        <span aria-hidden="true">{t`Review`}</span>
                        <span id={reviewLabelId} className="sr-only">
                          {isolateLanguageValue(
                            t`Review ${LANGUAGE_VALUE_MARKER}`,
                            request.pluginName,
                          )}
                        </span>
                      </Button>
                    </div>
                  );
                }}
              />
            ))}
          </SettingsGroup>
        </section>
      )}
      {review}
    </>
  );
}

/** The review an agent's request needs: an install or update shows the
 * pinned commit's access as an import does; enable and remove confirm
 * directly. Applying the change settles the request. */
export function RequestReview({
  plugins,
  catalog,
  busy,
  request,
  authorizeGit,
  holdReview,
  returnFocus,
  onClose,
}: {
  plugins: PluginManager;
  catalog: Catalog;
  busy: boolean;
  request: PluginRequest;
  authorizeGit?: Authorize | undefined;
  /** Refuses plugin install requests while a review is open. */
  holdReview?: (() => () => void) | undefined;
  returnFocus: () => HTMLElement | null;
  onClose: () => void;
}) {
  const { i18n } = useLingui();
  return !request.source ? (
    <ChangeReview
      plugins={plugins}
      catalog={catalog}
      request={request}
      holdReview={holdReview}
      returnFocus={returnFocus}
      onClose={onClose}
    />
  ) : (
    <ManagedPluginReview
      lang={i18n.locale}
      plugins={plugins}
      catalog={catalog}
      busy={busy}
      source={request.requester.name}
      entry={{
        id: request.pluginId,
        ...request.source,
        state: request.action === "install" ? "missing" : "outdated",
      }}
      authorizeGit={authorizeGit}
      holdReview={holdReview}
      requestedBy={{
        name: request.requester.name,
        reason: request.reason,
      }}
      recheck={() => plugins.requests.conflict(request.pluginId)}
      returnFocus={returnFocus}
      onInstalled={() => plugins.requests.settle(request.id, "approved")}
      onClose={onClose}
    />
  );
}

/** Enable and remove change no code, so they confirm here rather than
 * through an import review. */
function ChangeReview({
  plugins,
  catalog,
  request,
  holdReview,
  returnFocus,
  onClose,
}: {
  plugins: PluginManager;
  catalog: Catalog;
  request: PluginRequest;
  holdReview?: (() => () => void) | undefined;
  returnFocus: () => HTMLElement | null;
  onClose: () => void;
}) {
  const { i18n, t } = useLingui();
  useEffect(() => holdReview?.(), [holdReview]);
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | true | null>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const plugin = catalog.plugins.find(
    (item) => item.manifest.id === request.pluginId,
  );
  const name = plugin?.manifest.name ?? request.pluginName;
  const { action } = request;
  async function confirm() {
    if (working || (action !== "enable" && action !== "remove")) return;
    setWorking(true);
    setFailure(null);
    try {
      if (await plugins.change(action, request.pluginId)) {
        plugins.requests.settle(request.id, "approved");
        onClose();
      } else setFailure(plugins.snapshot().error ?? true);
    } finally {
      setWorking(false);
    }
  }
  const body = (
    <>
      <p lang="" className="mb-4 mt-0 break-words text-body-sm">
        {request.reason}
      </p>
      {!plugin && (
        <p lang={i18n.locale} className="m-0 text-body-sm">
          {t`This plugin is no longer installed.`}
        </p>
      )}
      {failure && (
        <p
          lang={failure === true ? i18n.locale : ""}
          role="alert"
          className="error text-body-sm"
        >
          {failure === true
            ? t`The change wasn’t confirmed. Try again.`
            : failure}
        </p>
      )}
    </>
  );
  if (action === "remove")
    return (
      <AlertDialog
        lang={i18n.locale}
        closeLabel={t`Close`}
        title={isolateLanguageValue(t`Delete ${LANGUAGE_VALUE_MARKER}?`, name)}
        description={
          <span lang={i18n.locale}>
            {isolateLanguageValue(
              t`Requested by ${LANGUAGE_VALUE_MARKER}. Removes this plugin and its rollback history from Buzz. You can install it again later.`,
              request.requester.name,
            )}
          </span>
        }
        pending={working}
        initialFocus={cancel}
        finalFocus={returnFocus}
        onClose={onClose}
        actions={
          <>
            <Button ref={cancel} disabled={working} onClick={onClose}>
              {t`Cancel`}
            </Button>
            <Button
              variant="destructive"
              disabled={working || !plugin}
              onClick={() => void confirm()}
            >
              {t`Delete plugin`}
            </Button>
          </>
        }
      >
        {body}
      </AlertDialog>
    );
  return (
    <Dialog
      open
      lang={i18n.locale}
      closeLabel={t`Close`}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={isolateLanguageValue(t`Enable ${LANGUAGE_VALUE_MARKER}?`, name)}
      description={
        <span lang={i18n.locale}>
          {isolateLanguageValue(
            t`Requested by ${LANGUAGE_VALUE_MARKER}. Only enable code you trust.`,
            request.requester.name,
          )}
        </span>
      }
      preventClose={working}
      dismissOnOutsideClick
      initialFocus={cancel}
      finalFocus={returnFocus}
      actions={
        <>
          <Button ref={cancel} disabled={working} onClick={onClose}>
            {t`Cancel`}
          </Button>
          <Button
            variant="prominent"
            disabled={working || !plugin}
            loading={working}
            onClick={() => void confirm()}
          >
            {t`Enable plugin`}
          </Button>
        </>
      }
    >
      {body}
      {plugin && (
        <div lang="">
          <PluginAccessReview manifest={plugin.manifest} />
        </div>
      )}
    </Dialog>
  );
}
