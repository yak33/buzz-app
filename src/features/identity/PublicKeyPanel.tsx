import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { writeClipboardText } from "../../shared/clipboard";
import { CopyIcon } from "../../shared/design-system/icons/index";
import { Button } from "../../shared/design-system/ui/Button";
import { WireframePanel } from "./Wireframe";

/**
 * A full npub — never hex or an abbreviation — with Copy and inline copy
 * feedback, for first-run pages that render outside ToastProvider. The
 * Profile panel's public-key recipe.
 */
export function PublicKeyPanel({
  publicKey,
  heading,
}: {
  publicKey: string;
  heading?: string;
}) {
  const { i18n, t } = useLingui();
  const [copyStatus, setCopyStatus] = useState("");
  return (
    <WireframePanel>
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-body text-subtle">
          {heading ?? t`Your public key (npub)`}
        </h2>
        <Button
          size="sm"
          variant="ghost"
          aria-label={t`Copy npub`}
          onClick={() => {
            setCopyStatus("");
            writeClipboardText(publicKey).then(
              () => setCopyStatus(i18n._(msg`Public key copied.`)),
              () =>
                setCopyStatus(
                  i18n._(
                    msg`Could not copy. Select the key above to copy it.`,
                  ),
                ),
            );
          }}
        >
          <CopyIcon size={16} aria-hidden="true" />
          {t`Copy`}
        </Button>
      </div>
      <code className="block select-text break-all font-mono text-mono">
        {publicKey}
      </code>
      <p className="m-0 text-body-sm text-subtle">
        {t`This is your public identity — it’s safe to share.`}
      </p>
      <span role="status" className="text-body-sm text-subtle">
        {copyStatus}
      </span>
    </WireframePanel>
  );
}
