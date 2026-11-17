import { useLingui } from "@lingui/react/macro";
import { useId, useRef, useState, type RefObject } from "react";
import { Dialog, type DialogProps } from "../../shared/design-system/ui/Dialog";
import { Button } from "../../shared/design-system/ui/Button";
import { Field } from "../../shared/design-system/ui/Field";
import { Input } from "../../shared/design-system/ui/Input";
import type { ComposerInputElement, ComposerLinkEdit } from "./composer-dom";
import { composerLinkUrl } from "./composer-link";

export function ComposerLinkDialog({
  edit,
  input,
  finalFocus = input,
  disabled,
  close,
}: {
  edit: ComposerLinkEdit;
  input: RefObject<ComposerInputElement | null>;
  finalFocus?: DialogProps["finalFocus"];
  disabled: boolean;
  close(): void;
}) {
  const { t, i18n } = useLingui();
  const formId = useId();
  const textInput = useRef<HTMLInputElement>(null);
  const urlInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(edit.text);
  const [url, setUrl] = useState(edit.href);
  const [error, setError] = useState("");
  const save = () => {
    if (disabled) return;
    const href = composerLinkUrl(url);
    if (!href) {
      setError(t`Use an HTTP(S) URL or a valid buzz:// link.`);
      return;
    }
    if (/[\r\n]/.test(text)) {
      setError(t`Link text must stay on one line.`);
      return;
    }
    if (!edit.save(text, href)) {
      setError(
        t`The draft changed or this link exceeds the message limit. Close and try again.`,
      );
      return;
    }
    close();
  };
  return (
    <Dialog
      lang={i18n.locale}
      closeLabel={t`Close`}
      size="compact"
      open
      dismissOnOutsideClick={false}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={edit.existing ? t`Edit link` : t`Add link`}
      initialFocus={edit.text ? urlInput : textInput}
      finalFocus={finalFocus}
      actions={
        <>
          {edit.existing && (
            <Button
              disabled={disabled}
              onClick={() => {
                if (edit.remove()) close();
                else setError(t`The draft changed. Close and try again.`);
              }}
            >{t`Remove link`}</Button>
          )}
          <Button onClick={close}>{t`Cancel`}</Button>
          <Button
            variant="prominent"
            type="submit"
            form={formId}
            disabled={disabled || !url.trim()}
          >{t`Save`}</Button>
        </>
      }
    >
      <form
        id={formId}
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          save();
        }}
      >
        <Field label={t`Text`}>
          <Input
            lang=""
            ref={textInput}
            value={text}
            onValueChange={setText}
            disabled={disabled}
            autoComplete="off"
          />
        </Field>
        <Field label="URL" error={error || undefined}>
          <Input
            ref={urlInput}
            value={url}
            onValueChange={(value) => {
              setUrl(value);
              setError("");
            }}
            disabled={disabled}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </Field>
      </form>
    </Dialog>
  );
}
