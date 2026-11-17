import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { TrashIcon } from "../../shared/design-system/icons";
import { Field } from "../../shared/design-system/ui/Field";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { Input } from "../../shared/design-system/ui/Input";
import { Select } from "../../shared/design-system/ui/Select";
import { Tabs } from "../../shared/design-system/ui/Tabs";
import { Textarea } from "../../shared/design-system/ui/Textarea";
import { ConfirmAction } from "./ConfirmAction";
import {
  buildConditionExpressions,
  conditionFieldsForTrigger,
  conditionOperatorsForField,
  conditionOperatorNeedsValue,
  conditionRowError,
  defaultConditionOperatorForField,
  parseConditionExpressions,
  type ConditionOperator,
  type ParsedConditionExpression,
} from "./workflowConditionExpression";
import type { TriggerConfig } from "./workflowFormTypes";

const LABELS: Record<ConditionOperator, MessageDescriptor> = {
  contains: msg`Contains`,
  not_contains: msg`Does not contain`,
  starts_with: msg`Starts with`,
  ends_with: msg`Ends with`,
  equals: msg`Equals`,
  not_equals: msg`Does not equal`,
  is_not_empty: msg`Is not empty`,
  is_empty: msg`Is empty`,
};

/** Incomplete Basic rows stay local; only an explicit edit may replace an expression. */
export function WorkflowConditions({
  trigger,
  disabled,
  onChange,
}: {
  trigger: TriggerConfig;
  disabled: boolean;
  onChange: (patch: Partial<TriggerConfig>) => void;
}) {
  const { i18n, t } = useLingui();
  const expression = trigger.filter ?? "";
  const parsed = parseConditionExpressions(expression, trigger.on);
  const [mode, setMode] = useState<"basic" | "advanced">(() =>
    parsed ? "basic" : "advanced",
  );
  const [replace, setReplace] = useState(false);
  const [modeError, setModeError] = useState(false);
  const rows = trigger.conditionRows ?? parsed ?? [];
  const fields = conditionFieldsForTrigger(trigger.on);
  const update = (next: ParsedConditionExpression[]) => {
    if (disabled) return;
    const filter = buildConditionExpressions(next);
    onChange({ filter, conditionRows: next });
  };
  return (
    <div className="workflow-options">
      <Tabs
        variant="panel"
        label={t`Condition mode`}
        value={mode}
        items={[
          { value: "basic", label: t`Basic` },
          { value: "advanced", label: t`Advanced` },
        ]}
        onValueChange={(next) => {
          if (next === "advanced" && rows.some(conditionRowError)) {
            setModeError(true);
            return;
          }
          setModeError(false);
          if (next === "basic" && parsed === null) setReplace(true);
          else setMode(next);
        }}
      />
      {modeError && rows.some(conditionRowError) && (
        <p role="alert" className="text-danger">
          {t`Complete or remove the invalid condition before switching to Advanced.`}
        </p>
      )}
      {mode === "advanced" ? (
        <Field
          label={t`Trigger condition (optional)`}
          description={t`An evalexpr expression; leave empty to match every event of this type.`}
        >
          <Textarea
            variant="code"
            rows={4}
            disabled={disabled}
            value={expression}
            onChange={(event) => {
              onChange({
                filter: event.currentTarget.value,
                conditionRows: undefined,
              });
            }}
          />
        </Field>
      ) : (
        <>
          <p className="text-body-sm text-subtle">
            {rows.length
              ? t`All conditions must match.`
              : t`Runs for every matching event. Add a condition to narrow it down.`}
          </p>
          {rows.map((row, index) => {
            // 拆出局部变量：label 是 MessageDescriptor，渲染前先经 i18n._ 解析。
            const field = fields.find((item) => item.value === row.field);
            const fieldLabel = field ? i18n._(field.label) : undefined;
            return (
            <div className="workflow-condition" key={row.field}>
              <div className="workflow-condition-heading">
                <span className="text-label-sm">{fieldLabel}</span>
                <IconButton
                  aria-label={t`Remove ${fieldLabel} condition`}
                  icon={<TrashIcon size={16} aria-hidden="true" />}
                  disabled={disabled}
                  onClick={() => update(rows.filter((_, i) => i !== index))}
                />
              </div>
              <Select
                label={t`${fieldLabel} comparison`}
                variant="field"
                disabled={disabled}
                value={row.operator}
                groups={[
                  {
                    label: "",
                    options: conditionOperatorsForField(row.field).map(
                      (value) => ({ value, label: i18n._(LABELS[value]) }),
                    ),
                  },
                ]}
                onValueChange={(operator) =>
                  update(
                    rows.map((item, i) =>
                      i === index
                        ? { ...item, operator: operator as ConditionOperator }
                        : item,
                    ),
                  )
                }
              />
              {conditionOperatorNeedsValue(row.operator) && (
                <Field
                  label={t`Value`}
                  error={conditionRowError(row) ?? undefined}
                >
                  <Input
                    value={row.value}
                    disabled={disabled}
                    onValueChange={(value) =>
                      update(
                        rows.map((item, i) =>
                          i === index ? { ...item, value } : item,
                        ),
                      )
                    }
                  />
                </Field>
              )}
            </div>
            );
          })}
          {fields.some(
            (field) => !rows.some((row) => row.field === field.value),
          ) && (
            <Select
              label={t`Add condition`}
              variant="field"
              disabled={disabled}
              value=""
              groups={[
                {
                  label: "",
                  options: fields
                    .filter((field) => !rows.some((row) => row.field === field.value))
                    .map((field) => ({
                      value: field.value,
                      label: i18n._(field.label),
                    })),
                },
              ]}
              onValueChange={(field) =>
                update([
                  ...rows,
                  {
                    field,
                    operator: defaultConditionOperatorForField(field),
                    value: "",
                    webhookField: "",
                  },
                ])
              }
            />
          )}
        </>
      )}
      {replace && (
        <ConfirmAction
          title={t`Replace with basic filters?`}
          description={t`This expression cannot be represented by Basic conditions. Replacing it clears the expression; cancel to keep it unchanged.`}
          action={t`Replace with basic filters`}
          onCancel={() => setReplace(false)}
          onConfirm={() => {
            update([]);
            setMode("basic");
            setReplace(false);
          }}
        />
      )}
    </div>
  );
}
