import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react/macro";
import styles from "./IdentitySetup.module.css";

export function SetupProgress({ label }: { label: MessageDescriptor }) {
  const { i18n, t } = useLingui();
  return (
    <div className={styles.progress}>
      <span className={styles.loadingBee} aria-hidden="true" />
      <h1
        id="welcome-title"
        tabIndex={-1}
        className="text-heading text-standard"
      >
        {t`Getting ready`}
      </h1>
      <span role="status" className="sr-only">
        {i18n._(label)}
      </span>
    </div>
  );
}
