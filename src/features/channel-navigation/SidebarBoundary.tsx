import { useLingui } from "@lingui/react/macro";
import { Component, type ComponentProps, type ReactNode } from "react";
import { SidebarFrame } from "./SidebarFrame";
import { SidebarList } from "./SidebarList";
import { Button } from "../../shared/design-system/ui/Button";

/** The fallback surface shown in place of a sidebar that failed to open. */
function SidebarFailure({
  header,
  panelId,
  onRetry,
}: Pick<ComponentProps<typeof SidebarFrame>, "header" | "panelId"> & {
  onRetry: () => void;
}) {
  const { i18n, t } = useLingui();
  return (
    <SidebarFrame
      label={t`Sidebar`}
      labelLang={i18n.locale}
      header={header}
      panelId={panelId}
    >
      <SidebarList>
        <p role="alert" lang={i18n.locale}>{t`Conversations couldn’t open.`}</p>
        <Button lang={i18n.locale} onClick={onRetry}>{t`Retry sidebar`}</Button>
      </SidebarList>
    </SidebarFrame>
  );
}

export class SidebarBoundary extends Component<
  Pick<ComponentProps<typeof SidebarFrame>, "header" | "panelId"> & {
    children: ReactNode;
  },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="shell-sidebar-default">
        <SidebarFailure
          header={this.props.header}
          panelId={this.props.panelId}
          onRetry={() => this.setState({ failed: false })}
        />
      </div>
    ) : (
      this.props.children
    );
  }
}
