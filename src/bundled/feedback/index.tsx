import { msg } from "@lingui/core/macro";
import { i18n } from "../../features/localization/service";
import type { PluginModule } from "../../plugins/api";
import { ChatCircleIcon } from "../../shared/design-system/icons";
import { FeedbackDialog } from "./FeedbackDialog";

export const inject = ["accountActions", "relay"];
export const apply: PluginModule["apply"] = (ctx) => {
  const relay = ctx.relay;
  ctx.accountActions.register({
    id: "send",
    title: i18n._(msg`Send feedback`),
    icon: <ChatCircleIcon size={17} />,
    component: (props) => <FeedbackDialog {...props} relay={relay} />,
  });
};
