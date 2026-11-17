import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useState, useRef, type RefObject } from "react";
import { Button } from "../../shared/design-system/ui/Button";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { Field } from "../../shared/design-system/ui/Field";
import { Radio, RadioGroup } from "../../shared/design-system/ui/RadioGroup";
import { DEFAULT_ACTIVE_WINDOW_SECONDS } from "../../features/relay/sidebar-preferences";
// 本地化服务是全局单例（见 lingui.config.ts），供非组件的工具函数在调用时求值。
import { i18n } from "../../features/localization/service";
import styles from "./SidebarActiveDialog.module.css";

export function activeWindowLabel(seconds = DEFAULT_ACTIVE_WINDOW_SECONDS) {
  const days = seconds / 86400;
  // 单复数拆成两个完整模板，避免在插值里做词形变化。
  return days === 1 ? i18n._(msg`1 day`) : i18n._(msg`${days} days`);
}

/** A draft stays local until Apply; a failed save keeps the entered values. */
export function SidebarActiveDialog({
  seconds = DEFAULT_ACTIVE_WINDOW_SECONDS,
  apply,
  close,
  finalFocus,
}: {
  seconds?: number | undefined;
  apply: (seconds: number) => unknown;
  close: () => void;
  finalFocus: RefObject<HTMLButtonElement | null>;
}) {
  const { t } = useLingui();
  const form = useRef<HTMLDivElement>(null);
  const days = seconds / 86400;
  const [preset, setPreset] = useState(
    [1, 7, 30, 90].includes(days) ? String(days) : "30",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const duration = Number(preset) * 86400;
  const submit = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await apply(duration);
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog
      size="compact"
      open
      title={t`Active in the last`}
      headerGap="compact"
      footerGap="compact"
      onOpenChange={(open) => !open && close()}
      preventClose={pending}
      finalFocus={finalFocus}
      initialFocus={() =>
        form.current?.querySelector<HTMLElement>(
          '[role="radio"][aria-checked="true"]',
        ) ?? false
      }
      actions={
        <>
          <Button disabled={pending} onClick={close}>
            {t`Cancel`}
          </Button>
          <Button
            variant="prominent"
            loading={pending}
            onClick={() => void submit()}
          >
            {t`Apply`}
          </Button>
        </>
      }
    >
      <div ref={form} className={styles.form}>
        <Field
          label={t`Time frame`}
          labelVisibility="hidden"
          nativeLabel={false}
        >
          <RadioGroup
            value={preset}
            onValueChange={setPreset}
            disabled={pending}
            aria-label={t`Time frame`}
          >
            <div className={styles.presets}>
              {[1, 7, 30, 90].map((days) => (
                <Radio
                  key={days}
                  value={String(days)}
                  variant="tile"
                  label={activeWindowLabel(days * 86400)}
                />
              ))}
            </div>
          </RadioGroup>
        </Field>
        {error && (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}
        {pending && (
          <p role="status" className="sr-only">
            {t`Saving filter and waiting for confirmation…`}
          </p>
        )}
      </div>
    </Dialog>
  );
}
