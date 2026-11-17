import { useLingui } from "@lingui/react/macro";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { CloudUploadIcon } from "../../shared/design-system/icons";
import styles from "./Messages.module.css";

/** The existing nearest-pane drop owner also owns its visible affordance. */
export function FileDropOverlay({
  composer,
}: {
  composer: RefObject<HTMLFormElement | null>;
}) {
  const { t, i18n } = useLingui();
  const zone =
    composer.current?.closest<HTMLElement>("[data-attachment-drop-zone]") ??
    composer.current;
  return zone
    ? createPortal(
        <div
          lang={i18n.locale}
          className={styles.fileDropOverlay}
          role="status"
        >
          <CloudUploadIcon size={32} />
          <span>{t`Drop files into this conversation`}</span>
        </div>,
        zone,
      )
    : null;
}
