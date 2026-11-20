import { SidebarNavigation } from "../../shared/design-system/ui/SidebarNavigation";
import { useId, type ReactNode } from "react";
import { Panel } from "../../shared/design-system/ui/Panel";
import styles from "../../bundled/channels/Channels.module.css";

/** Shared sidebar surface; callers own its contents, data and scroll behavior. */
export function SidebarFrame({
  label,
  labelLang,
  busy,
  launchPending,
  children,
  header,
  panelId,
}: {
  label: string;
  /** Keeps the landmark name's language local to its label, not its content. */
  labelLang?: string | undefined;
  header?: ReactNode;
  panelId?: string | undefined;
  busy?: boolean | undefined;
  launchPending?: "required" | "settling" | undefined;
  children?: ReactNode;
}) {
  const labelId = useId();
  return (
    <Panel
      as="aside"
      aria-label={label}
      aria-labelledby={labelLang ? labelId : undefined}
      aria-busy={busy}
      data-buzz-launch-pending={launchPending}
    >
      {labelLang && (
        <span id={labelId} className="sr-only" lang={labelLang}>
          {label}
        </span>
      )}
      <div className={styles.sidebar}>
        <SidebarNavigation>
          {header && <div className={styles.sidebarFilter}>{header}</div>}
          <div
            className={styles.sidebarBody}
            id={panelId}
            {...(panelId
              ? { role: "tabpanel", "aria-labelledby": `${panelId}-tab` }
              : {})}
          >
            {children}
          </div>
        </SidebarNavigation>
      </div>
    </Panel>
  );
}
