import { useLingui } from "@lingui/react/macro";
import { usePanelTabHost } from "./PanelWorkspace";
import type { Ref } from "react";
import { Panel } from "../../shared/design-system/ui/Panel";
import {
  PanelHeader,
  PanelHeaderLabel,
} from "../../shared/design-system/ui/PanelHeader";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { XIcon } from "../../shared/design-system/icons/index";
import type { PanelProps, RegisteredPanel } from "./service";
import { PanelSubviewHost } from "./PanelSubview";
import { PanelView } from "./PanelView";
import styles from "./Panels.module.css";

// Ordinary shared UI: the caller still owns placement and selection.
export function PanelCard({
  ref,
  panel,
  contentKey,
  ...props
}: PanelProps & {
  ref?: Ref<HTMLElement>;
  panel: RegisteredPanel;
  contentKey?: string;
}) {
  const { i18n } = useLingui();
  const tabbed = !!usePanelTabHost();
  // 面板标题在渲染期翻译，语言切换即时生效。
  const title =
    typeof panel.title === "string" ? panel.title : i18n._(panel.title);
  return (
    <aside
      ref={ref}
      tabIndex={-1}
      className={styles.cardLayout}
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.shiftKey && !tabbed) {
          event.stopPropagation();
          props.close();
        }
      }}
    >
      <Panel as="div">
        <PanelSubviewHost close={props.close}>
          <div className={styles.card}>
            {!tabbed && (
              <PanelHeader
                title={
                  panel.launcher ? (
                    <PanelHeaderLabel
                      title={title}
                      icon={<img src={panel.launcher.icon} alt="" />}
                    />
                  ) : (
                    title
                  )
                }
                actions={
                  <IconButton
                    size="toolbar"
                    aria-label={`Close ${title} panel`}
                    onClick={props.close}
                    icon={<XIcon size={18} aria-hidden="true" />}
                  />
                }
              />
            )}
            <div className={styles.content}>
              <PanelView panel={panel} contentKey={contentKey} {...props} />
            </div>
          </div>
        </PanelSubviewHost>
      </Panel>
    </aside>
  );
}
