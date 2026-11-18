import { useLingui } from "@lingui/react/macro";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { Component, useState, type ReactNode } from "react";
import { SidebarIcon } from "../../shared/design-system/icons/index";
import type { RegisteredPanel } from "../../features/panels/service";

export function PanelLaunchers({
  panels,
  selected,
  launch,
}: {
  panels: readonly RegisteredPanel[];
  selected: RegisteredPanel | undefined;
  launch(panel: RegisteredPanel, trigger: HTMLButtonElement): void;
}) {
  const { i18n } = useLingui();
  return panels
    .filter((panel) => panel.launcher || panel.toolbar)
    .map((panel) => {
      // 面板标题在渲染期翻译，语言切换即时生效。
      const title =
        typeof panel.title === "string" ? panel.title : i18n._(panel.title);
      return panel.toolbar ? (
        <ToolbarBoundary
          key={`${panel.key}:${panel.revision}`}
          title={title}
        >
          <panel.toolbar />
        </ToolbarBoundary>
      ) : (
        <IconButton
          type="button"
          key={`${panel.key}:${panel.revision}`}
          variant="chrome"
          aria-label={title}
          title={title}
          aria-expanded={panel === selected}
          onClick={(event) => launch(panel, event.currentTarget)}
          icon={
            <LauncherIcon
              key={panel.launcher?.icon}
              src={panel.launcher?.icon ?? ""}
            />
          }
        />
      );
    });
}
function LauncherIcon({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <SidebarIcon size={16} aria-hidden="true" />
  ) : (
    <img
      src={src}
      alt=""
      className="object-contain"
      onError={() => setFailed(true)}
    />
  );
}

class ToolbarBoundary extends Component<
  { title: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <span role="status" className="text-caption text-secondary">
        {this.props.title} controls unavailable
      </span>
    ) : (
      this.props.children
    );
  }
}
