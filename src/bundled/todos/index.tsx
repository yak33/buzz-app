import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useCallback, useSyncExternalStore } from "react";
import type { PluginModule } from "../../plugins/api";
import type {
  ChannelLauncherProps,
  PanelProps,
} from "../../features/panels/service";
import { ListChecksIcon } from "../../shared/design-system/icons/index";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { TodosPanel } from "./TodosPanel";

export const inject = ["panels", "relay"];
export const apply: PluginModule["apply"] = (ctx) => {
  let active = true;
  ctx.effect(() => () => {
    active = false;
  });
  function Launcher({
    context,
    toggle,
    pressed,
    available,
  }: ChannelLauncherProps) {
    const { t } = useLingui();
    return (
      <IconButton
        size="sm"
        variant="ghost"
        data-channel-panel-toggle=""
        icon={<ListChecksIcon size={16} aria-hidden="true" />}
        aria-label={t`Toggle channel todos`}
        title={t`Todos`}
        aria-expanded={pressed}
        onClick={(event) => {
          event.currentTarget.focus();
          if (active && available()) toggle(context.channelId);
        }}
      />
    );
  }
  function Panel({ channelContext, close, context: host }: PanelProps) {
    const { t } = useLingui();
    const state = useSyncExternalStore(ctx.relay.subscribe, ctx.relay.snapshot);
    const isActive = useCallback(
      () => active && ctx.relay.snapshot() === state,
      [state],
    );
    if (
      !channelContext ||
      state.status !== "ready" ||
      state.scope !== channelContext.scope
    )
      return <p role="status">{t`Connect to this channel to view todos.`}</p>;
    return (
      <TodosPanel
        key={`${state.scope}:${state.generation}:${channelContext.channelId}`}
        canvas={state.session.canvas}
        people={state.session}
        context={channelContext}
        close={close}
        active={isActive}
        onOpenLink={(url) => host?.open(url) ?? false}
      />
    );
  }
  ctx.panels.register({
    id: "todos",
    title: msg`Todos`,
    matches: () => false,
    channelLauncher: Launcher,
    channelPlacement: "side",
    component: Panel,
  });
};
