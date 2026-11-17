import { useLingui } from "@lingui/react/macro";
import { ArrowLeftIcon } from "../../shared/design-system/icons";
import {
  IconButton,
  type IconButtonProps,
} from "../../shared/design-system/ui/IconButton";

export function OnboardingBack({
  "aria-label": label,
  ...props
}: Omit<IconButtonProps, "icon" | "aria-label"> & { "aria-label"?: string }) {
  const { t } = useLingui();
  return (
    <IconButton
      {...props}
      aria-label={label ?? t`Back`}
      icon={<ArrowLeftIcon />}
      size="lg"
      shape="round"
      variant="subtle"
      data-onboarding-back=""
    />
  );
}
