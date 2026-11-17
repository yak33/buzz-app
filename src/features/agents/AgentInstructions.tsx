import { useLingui } from "@lingui/react/macro";
import { Field } from "../../shared/design-system/ui/Field";
import { Textarea } from "../../shared/design-system/ui/Textarea";

export function AgentInstructions({
  value,
  disabled,
  onChange,
  description,
  creation = false,
}: {
  value: string;
  disabled: boolean;
  onChange(value: string): void;
  description?: string | undefined;
  creation?: boolean;
}) {
  const { t } = useLingui();
  return (
    <Field label={t`Instructions`} description={description} optional={creation}>
      <Textarea
        appearance="outlined"
        rows={creation ? 4 : 8}
        value={value}
        disabled={disabled}
        placeholder={t`Help me plan my week and prioritize tasks.`}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
