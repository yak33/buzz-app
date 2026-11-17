import { useLingui } from "@lingui/react/macro";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { useSyncExternalStore } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
} from "../../shared/design-system/icons/index";
import type { Navigation } from "../../features/navigation/controller";
export function NavigationControls({ navigation }: { navigation: Navigation }) {
  const { t, i18n } = useLingui();
  const state = useSyncExternalStore(navigation.subscribe, navigation.snapshot);
  return (
    <nav
      lang={i18n.locale}
      className="flex shrink-0 items-center gap-0"
      aria-label={t`Navigation history`}
    >
      <IconButton
        hint="familiar"
        type="button"
        variant="ghost"
        aria-label={t`Go back`}
        title={t`Go back`}
        disabled={!state.canGoBack}
        onClick={navigation.back}
        icon={<ArrowLeftIcon size={16} aria-hidden="true" />}
      />
      <IconButton
        hint="familiar"
        type="button"
        variant="ghost"
        aria-label={t`Go forward`}
        title={t`Go forward`}
        disabled={!state.canGoForward}
        onClick={navigation.forward}
        icon={<ArrowRightIcon size={16} aria-hidden="true" />}
      />
    </nav>
  );
}
