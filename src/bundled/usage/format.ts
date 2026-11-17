import { msg } from "@lingui/core/macro";
// 本地化全局单例：这些帮助函数在组件外调用（先例 src/shared/datetime.ts）。
import { i18n } from "../../features/localization/service";
import type { Total } from "./stats";

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** USD to the cent; a nonzero amount under a cent as such. */
export const cost = (usd: number) =>
  usd > 0 && usd < 0.005 ? "<$0.01" : dollars.format(usd);
export const percent = (share: number) => `${Math.round(share * 100)}%`;
/** A count in compact form, e.g. 12.4M, with `noun` pluralized. */
export function count(value: number, noun?: string) {
  const number = compact.format(value);
  // 复数拆成两条完整模板，单复数各自进翻译目录。
  if (!noun) return number;
  return value === 1
    ? i18n._(msg`${number} ${noun}`)
    : i18n._(msg`${number} ${noun}s`);
}
/** A cost total as text: `Unavailable` when unknown, marked when partial. */
export const costText = (total: Total) =>
  total.value === undefined
    ? i18n._(msg`Unavailable`)
    : `${cost(total.value)}${total.partial ? i18n._(msg` · partial`) : ""}`;
/** A total's known value in `format`; `Unavailable` when none was known. */
export const amount = (total: Total, format: (value: number) => string) =>
  total.value === undefined ? i18n._(msg`Unavailable`) : format(total.value);
