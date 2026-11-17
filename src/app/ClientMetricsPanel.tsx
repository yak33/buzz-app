import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { InlineHeader } from "../shared/design-system/ui/Header";
import styles from "./DeveloperSettings.module.css";
import { Button } from "../shared/design-system/ui/Button";
import { Accordion } from "../shared/design-system/ui/Accordion";
import { useEffect, useState } from "react";
import type { I18n, MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import {
  clientMetrics,
  type OpenSource,
} from "../features/developer/client-metrics";

const METRICS_POLL_MS = 2000;
const ms = (value: number | undefined) =>
  value === undefined ? "–" : `${Math.round(value)} ms`;
type Summary = ReturnType<typeof clientMetrics.summary>;
type Loads = Summary["opens"]["bySource"][OpenSource];
type Phase = Summary["phases"][number];

const SOURCES: readonly [OpenSource, MessageDescriptor][] = [
  ["memory", msg`Memory`],
  ["disk", msg`Disk`],
  ["disk-late", msg`Disk, late`],
  ["network", msg`Server`],
];
// Emphasis: the wait is what caching and relay work change; render is context.
const WAIT = "bg-affordance-accent-prominent";
const RENDER = "bg-current text-metadata";

function Swatch({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2 rounded-full ${className}`}
    />
  );
}

/** One source's median open as wait + render, scaled to the slowest source. */
function LoadRow({
  label,
  loads,
  scale,
}: {
  label: string;
  loads: Loads;
  scale: number;
}) {
  const { t } = useLingui();
  const wait = loads.waitP50 ?? 0;
  const render = loads.renderP50 ?? 0;
  const width = (value: number) => `${(value / scale) * 100}%`;
  return (
    <li className={styles.loadRow}>
      <span className="text-body-sm">
        {label} <span className="text-metadata tabular-nums">{loads.n}</span>
      </span>
      <span className="text-body-sm tabular-nums">{ms(loads.p50)}</span>
      <span
        className={styles.loadBar}
        title={t`Wait ${ms(wait)}, render ${ms(render)}`}
      >
        {loads.n > 0 && wait > 0 && (
          <span className={WAIT} style={{ width: width(wait) }} />
        )}
        {loads.n > 0 && (
          <span className={RENDER} style={{ width: width(render) }} />
        )}
      </span>
      <span className={`${styles.loadDetail} text-metadata tabular-nums`}>
        {loads.n
          ? t`wait ${ms(wait)} · render ${ms(render)} · p90 ${ms(loads.p90)}`
          : t`No opens yet`}
      </span>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-metadata">{label}</dt>
      <dd className="m-0 text-heading tabular-nums">{value}</dd>
    </div>
  );
}

const phaseName = (phase: Phase, index: number, i18n: Pick<I18n, "_">) =>
  phase.kind === "open"
    ? i18n._(msg`App open`)
    : index
      ? i18n._(msg`Reconnect ${index}`)
      : i18n._(msg`Latest reconnect`);

export function ClientMetricsPanel() {
  const { i18n, t } = useLingui();
  const [summary, setSummary] = useState(clientMetrics.summary);
  useEffect(() => {
    const timer = setInterval(
      () => setSummary(clientMetrics.summary()),
      METRICS_POLL_MS,
    );
    return () => clearInterval(timer);
  }, []);
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(clientMetrics.export(), null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `buzz-client-metrics-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    link.click();
    // WebKit may still be reading the blob when click() returns.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const { opens, mainThread, phases } = summary;
  // A late disk restore is rare; show its row only when it happened.
  const rows = SOURCES.filter(
    ([source]) => source !== "disk-late" || opens.bySource[source].n,
  );
  const scale = Math.max(
    1,
    ...rows.map(
      ([source]) =>
        (opens.bySource[source].waitP50 ?? 0) +
        (opens.bySource[source].renderP50 ?? 0),
    ),
  );
  const [first, ...reconnects] = phases;
  const cpu = (stage: string) => mainThread.cpu[stage];
  // The label is translated outside the template so no macro nests in t``.
  const cpuLine = (label: MessageDescriptor, stage: string) => {
    const entry = cpu(stage);
    return entry
      ? `${i18n._(label)}: ${t`${ms(entry.ms)} for ${entry.count} events`}`
      : "";
  };

  return (
    <section
      aria-labelledby="client-performance-title"
      className="grid grid-cols-1 gap-8"
    >
      <div className={styles.metricsHeader}>
        <InlineHeader
          id="client-performance-title"
          title={t`Client performance`}
          subtitle={t`This window, since launch. Data stays on this device.`}
          actions={
            <div className={styles.actions}>
              <Button type="button" size="sm" onClick={download}>
                {t`Export JSON`}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  clientMetrics.reset();
                  setSummary(clientMetrics.summary());
                }}
              >
                {t`Reset`}
              </Button>
            </div>
          }
        />
        <SettingsGroup layout="form">
          <dl className={styles.metrics}>
            <Stat label={t`Channel opens`} value={String(opens.n)} />
            <Stat label={t`Median load`} value={ms(opens.p50)} />
            <Stat
              label={t`From cache`}
              value={
                opens.cacheHitRate === undefined
                  ? "–"
                  : `${Math.round(opens.cacheHitRate * 100)}%`
              }
            />
          </dl>
          {opens.skipped > 0 && (
            <p className="m-0 text-body-sm text-muted">
              {t`${opens.skipped} opens not timed: no visible messages to paint.`}
            </p>
          )}
        </SettingsGroup>
      </div>

      <section aria-labelledby="metrics-loads">
        <InlineHeader
          id="metrics-loads"
          title={t`Channel load`}
          subtitle={t`Median load time by source. Wait and render medians may not add up to the total.`}
        />
        <SettingsGroup layout="form">
          <p className="m-0 flex flex-wrap gap-x-4 text-metadata">
            <span className="flex items-center gap-1.5">
              <Swatch className={WAIT} /> {t`Wait: disk read or server request`}
            </span>
            <span className="flex items-center gap-1.5">
              <Swatch className={RENDER} />{" "}
              {t`Render: rows in memory to on screen`}
            </span>
          </p>
          <ul className="m-0 list-none space-y-6 p-0">
            {rows.map(([source, label]) => (
              <LoadRow
                key={source}
                label={i18n._(label)}
                loads={opens.bySource[source]}
                scale={scale}
              />
            ))}
          </ul>
        </SettingsGroup>
      </section>

      <section aria-labelledby="metrics-live">
        <InlineHeader
          id="metrics-live"
          title={t`Live subscriptions`}
          subtitle={t`A subscription is live after stored events arrive (EOSE), and settled when live or failed.`}
        />
        <SettingsGroup layout="form">
          {!first && (
            <p className="m-0 text-body-sm text-muted">
              {t`No connection measurements yet.`}
            </p>
          )}
          {first && (
            <dl className={styles.metrics}>
              <Stat label={t`Connected`} value={ms(first.authMs)} />
              <Stat
                label={
                  first.routes
                    ? t`All ${first.routes} settled`
                    : t`All settled`
                }
                value={ms(first.coverageMs)}
              />
              <Stat
                label={t`Each, median / slowest`}
                value={`${ms(first.routeMs.p50)} / ${ms(first.routeMs.max)}`}
              />
              <Stat label={t`Failed`} value={String(first.routeErrors)} />
            </dl>
          )}
          {reconnects.length > 0 && (
            <section
              className={styles.history}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: Scroll owner supports keyboard panning of connection history.
              tabIndex={0}
              aria-label={t`Connection history`}
            >
              <table className="text-body-sm tabular-nums">
                <thead>
                  <tr>
                    <th scope="col">{t`Connection`}</th>
                    <th scope="col">{t`Connected`}</th>
                    <th scope="col">{t`Settled`}</th>
                    <th scope="col">{t`Failed`}</th>
                  </tr>
                </thead>
                <tbody>
                  {phases.map((phase, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: phases are append-only
                    <tr key={index}>
                      <th scope="row">{phaseName(phase, index, i18n)}</th>
                      <td>{ms(phase.authMs)}</td>
                      <td>
                        {phase.routes} in {ms(phase.coverageMs)}
                      </td>
                      <td>{phase.routeErrors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </SettingsGroup>
      </section>

      <Accordion
        items={[
          {
            value: "details",
            title: t`Main thread and reads`,
            content: (
              <ul className="m-0 list-none space-y-1 p-0 text-body-sm tabular-nums">
                <li>
                  {t`Main thread blocked 50 ms or more: ${mainThread.longTasks} times, ${ms(mainThread.longTaskMs)} in total`}
                </li>
                {[
                  cpuLine(msg`Checking signatures of relay reads`, "verify.read"),
                  cpuLine(
                    msg`Checking signatures of disk restores`,
                    "verify.restore",
                  ),
                  cpuLine(msg`Building timelines from events`, "fold"),
                ]
                  .filter(Boolean)
                  .map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                {phases.map((phase, index) => (
                  <li
                    // biome-ignore lint/suspicious/noArrayIndexKey: append-only phases
                    key={`reads-${index}`}
                  >
                    {t`Reads during ${phaseName(phase, index, i18n).toLowerCase()}: ${phase.queries} (${phase.background} background), ${Math.round(phase.bytes / 1024)} KB`}
                  </li>
                ))}
              </ul>
            ),
          },
        ]}
      />
    </section>
  );
}
