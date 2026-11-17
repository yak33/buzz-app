import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../../shared/design-system/ui/Button";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { ConfirmAction } from "./ConfirmAction";
import { writeClipboardText } from "../../shared/clipboard";

/** Shown when the user leaves before revealing or copying; the relay cannot re-issue the secret. */
export const continueWithoutSecret = {
  title: msg`Continue without this secret?`,
  description: msg`This private webhook secret cannot be recovered. Copy and store it before continuing, or explicitly leave it behind.`,
  action: msg`Continue`,
  cancel: msg`Go back`,
  destructive: true,
};

/** One-time display of a webhook secret. The value lives in component state only. */
export function WorkflowWebhookSecretDialog({
  workflowId,
  hookUrl,
  take,
  onContinue,
}: {
  workflowId: string;
  /** Display address, or undefined when the host advertised no relay HTTP base. */
  hookUrl: string | undefined;
  /** One-shot hand-off from the capability; called once, when this dialog mounts. */
  take: () => string | undefined;
  onContinue: () => void;
}) {
  const { i18n, t } = useLingui();
  const id = useId();
  const [secret, setSecret] = useState<string>();
  const [revealed, setRevealed] = useState(false);
  const [handled, setHandled] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean }>();
  const taken = useRef(false);
  useEffect(() => {
    // StrictMode re-runs mount effects on the same instance; the ref keeps the
    // hand-off single-shot so a second pass cannot take nothing and lose it.
    if (taken.current) return;
    taken.current = true;
    const value = take();
    if (value !== undefined) setSecret(value);
  }, [take]);
  const copy = async (value: string, label: "URL" | "secret") => {
    try {
      await writeClipboardText(value);
      // 三元拆成两个完整模板，避免在插值表达式里拼接文案。
      setNotice({
        text:
          label === "URL" ? i18n._(msg`URL copied.`) : i18n._(msg`Secret copied.`),
        error: false,
      });
      if (label === "secret") setHandled(true);
    } catch {
      setNotice({
        text:
          label === "secret"
            ? i18n._(msg`Couldn’t copy the secret. Reveal it and copy it manually.`)
            : i18n._(msg`Couldn’t copy the URL. Select it and copy it manually.`),
        error: true,
      });
    }
  };
  const leave = () => {
    if (secret === undefined || handled) onContinue();
    else setConfirming(true);
  };
  return (
    <>
      <Dialog
        open
        dismissOnOutsideClick={false}
        onOpenChange={(open) => {
          if (!open) leave();
        }}
        title={t`Webhook ready`}
        description={t`This private secret is shown once and cannot be recovered. Copy and store it before continuing.`}
        actions={
          <Button variant="primary" onClick={leave}>
            {t`Continue`}
          </Button>
        }
      >
        <div className="workflow-secret">
          <p id={`${id}-url`} className="text-label-sm">
            {t`Webhook URL`}
          </p>
          {hookUrl ? (
            <div className="workflow-secret-row">
              <code
                className="workflow-secret-value text-mono-sm"
                data-testid="webhook-url"
              >
                {hookUrl}
              </code>
              <Button size="compact" onClick={() => void copy(hookUrl, "URL")}>
                {t`Copy URL`}
              </Button>
            </div>
          ) : (
            <p className="text-body-sm text-secondary">
              {t`The relay’s HTTP address is unavailable from this host. Send requests to`}{" "}
              <code>/hooks/{workflowId}</code>{" "}
              {t`on the relay.`}
            </p>
          )}
          <p id={`${id}-secret`} className="text-label-sm">
            {t`X-Webhook-Secret header`}
          </p>
          <div className="workflow-secret-row">
            <code
              className="workflow-secret-value text-mono-sm"
              data-testid="webhook-secret"
            >
              {secret === undefined
                ? t`Unavailable`
                : revealed
                  ? secret
                  : "•".repeat(24)}
            </code>
            <Button
              size="compact"
              aria-label={
                revealed
                  ? t`Hide webhook secret`
                  : t`Reveal webhook secret`
              }
              disabled={secret === undefined}
              onClick={() => {
                setRevealed((value) => !value);
                setHandled(true);
              }}
            >
              {revealed ? t`Hide` : t`Reveal`}
            </Button>
            <Button
              size="compact"
              disabled={secret === undefined}
              onClick={() =>
                secret !== undefined && void copy(secret, "secret")
              }
            >
              {t`Copy secret`}
            </Button>
          </div>
          {secret === undefined && (
            <p role="alert" className="text-body-sm text-danger">
              {t`This secret is no longer available from this session.`}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className={`text-body-sm ${notice.error ? "text-danger" : "text-secondary"}`}
            >
              {notice.text}
            </p>
          )}
        </div>
      </Dialog>
      {confirming && (
        <ConfirmAction
          title={i18n._(continueWithoutSecret.title)}
          description={i18n._(continueWithoutSecret.description)}
          action={i18n._(continueWithoutSecret.action)}
          cancel={i18n._(continueWithoutSecret.cancel)}
          destructive={continueWithoutSecret.destructive}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onContinue();
          }}
        />
      )}
    </>
  );
}
