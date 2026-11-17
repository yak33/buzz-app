import { useLingui } from "@lingui/react/macro";
import { enUS, zhCN } from "react-day-picker/locale";
import { Popover } from "@base-ui/react/popover";
import { useState } from "react";
import { Calendar } from "../../shared/design-system/ui/Calendar";
import { FieldButton } from "../../shared/design-system/ui/FieldButton";
import {
  MenuRoot,
  MenuTrigger,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
} from "../../shared/design-system/ui/Menu";
import styles from "./Status.module.css";

const times = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 ? "30" : "00";
  return {
    value: `${hour.toString().padStart(2, "0")}:${minute}`,
    label: `${hour % 12 || 12}:${minute} ${hour < 12 ? "AM" : "PM"}`,
  };
});

export function StatusExpiration({
  value,
  onChange,
  disabled,
  label: suppliedLabel,
}: {
  value: Date;
  onChange(value: Date): void;
  disabled: boolean;
  /** Names the date and time controls, e.g. "Focus end". */
  label?: string;
}) {
  const { t, i18n } = useLingui();
  const label = suppliedLabel ?? t`Status expiration`;
  const localizedTimes = times.map((option) => ({
    ...option,
    label: i18n.locale === "zh-CN" ? option.value : option.label,
  }));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const time = `${value.getHours().toString().padStart(2, "0")}:${value.getMinutes().toString().padStart(2, "0")}`;
  return (
    <div lang={i18n.locale} className={styles.expiration}>
      <span className="text-label-sm text-subtle">{t`Until`}</span>
      <div className={styles.expirationFields}>
        <Popover.Root open={calendarOpen} onOpenChange={setCalendarOpen}>
          <Popover.Trigger
            disabled={disabled}
            render={<FieldButton aria-label={t`${label} date`} />}
          >
            {value.toLocaleDateString(i18n.locale, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner
              sideOffset={4}
              align="start"
              collisionPadding={16}
              className={styles.calendarPositioner}
            >
              <Popover.Popup
                lang={i18n.locale}
                className={styles.calendarPopup}
                aria-label={t`Choose expiration date`}
              >
                <Calendar
                  locale={i18n.locale === "zh-CN" ? zhCN : enUS}
                  mode="single"
                  required
                  autoFocus
                  selected={value}
                  defaultMonth={value}
                  disabled={{ before: today }}
                  onSelect={(day) => {
                    const next = new Date(day);
                    next.setHours(
                      value.getHours(),
                      value.getMinutes(),
                      value.getSeconds(),
                      0,
                    );
                    onChange(next);
                    setCalendarOpen(false);
                  }}
                />
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
        <MenuRoot>
          <MenuTrigger
            disabled={disabled}
            render={<FieldButton aria-label={t`${label} time`} />}
          >
            {localizedTimes.find((option) => option.value === time)?.label ??
              value.toLocaleTimeString(i18n.locale, {
                hour: "numeric",
                minute: "2-digit",
              })}
          </MenuTrigger>
          <MenuPopup lang={i18n.locale} align="end" data-status-menu>
            <div className={styles.timeOptions}>
              <MenuRadioGroup
                value={time}
                aria-label={t`Expiration time`}
                onValueChange={(timeValue) => {
                  const hour = Number(timeValue.slice(0, 2));
                  const minute = Number(timeValue.slice(3));
                  const next = new Date(value);
                  next.setHours(hour, minute, 0, 0);
                  onChange(next);
                }}
              >
                {localizedTimes.map((option) => (
                  <MenuRadioItem
                    key={option.value}
                    value={option.value}
                    closeOnClick
                  >
                    {option.label}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </div>
          </MenuPopup>
        </MenuRoot>
      </div>
    </div>
  );
}
