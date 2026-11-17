import styles from "./DeveloperSettings.module.css";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { Header, InlineHeader } from "../shared/design-system/ui/Header";
import { PreferenceRow } from "../shared/design-system/ui/PreferenceRow";
import { Button } from "../shared/design-system/ui/Button";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Select } from "../shared/design-system/ui/Select";
import {
  developerSettings,
  isLogLevel,
  logLevel,
  LOG_LEVELS,
  subscribeLogLevel,
} from "../features/developer/logging";
import type { RelayData } from "../features/relay/service";
import { clientMetrics } from "../features/developer/client-metrics";
import { ClientMetricsPanel } from "./ClientMetricsPanel";
import { SwitchPreferenceRow } from "../shared/design-system/ui/SwitchPreferenceRow";
import {
  importScenario,
  setImportScenario,
  subscribeImportScenario,
  type ImportScenario,
} from "../features/developer/agent-import-scenario";

const IMPORT_SCENARIOS: readonly {
  value: ImportScenario;
  label: MessageDescriptor;
}[] = [
  { value: "off", label: msg`Real data` },
  { value: "none", label: msg`Nothing to import` },
  { value: "both", label: msg`Other communities and old Buzz` },
  { value: "communities", label: msg`Other communities only` },
  { value: "old", label: msg`Buzz (Legacy) only` },
];

type BrokerStats = {
  queries: number;
  errors: number;
  media: number;
  connects: number;
};

const STATS_POLL_MS = 5000;

/** Only the pinned development broker serves /api/relay/*. Missing stats in
 * that environment are normal, not an error. */
async function fetchStats(): Promise<BrokerStats | undefined> {
  try {
    const res = await fetch("/api/relay/stats");
    if (!res.ok) return undefined;
    return (await res.json()) as BrokerStats;
  } catch {
    return undefined;
  }
}

export function DeveloperSettings({ relay }: { relay: RelayData }) {
  const { i18n, t } = useLingui();
  const level = useSyncExternalStore(subscribeLogLevel, logLevel);
  const scenario = useSyncExternalStore(
    subscribeImportScenario,
    importScenario,
  );
  const [settingsReady, setSettingsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string>();
  useEffect(() => {
    let alive = true;
    void developerSettings()
      .then(() => {
        if (alive) setSettingsReady(true);
      })
      .catch(() => {
        if (alive)
          setSettingsError(
            i18n._(msg`Runtime settings require the local development server.`),
          );
      });
    return () => {
      alive = false;
    };
  }, [i18n]);
  async function saveLevel(value: string) {
    if (!isLogLevel(value)) return;
    setSaving(true);
    setSettingsError(undefined);
    try {
      await developerSettings(value);
    } catch {
      setSettingsError(i18n._(msg`Log level wasn’t saved. Try again.`));
    } finally {
      setSaving(false);
    }
  }
  const brokerAvailable = import.meta.env.VITE_BUZZ_LIVE === "1";
  const [stats, setStats] = useState<BrokerStats>();
  const [clearing, setClearing] = useState(false);
  const [status, setStatus] = useState<string>();

  useEffect(() => {
    if (!brokerAvailable) return;
    let alive = true;
    async function poll() {
      const next = await fetchStats();
      if (alive) setStats(next);
    }
    void poll();
    const timer = setInterval(poll, STATS_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  async function clearCache() {
    setClearing(true);
    try {
      await relay.clearCache();
      setStatus(
        i18n._(msg`Cache cleared. Buzz will load channels and media as needed.`),
      );
    } catch (error) {
      setStatus(i18n._(msg`Buzz couldn’t clear the cache. ${String(error)}`));
    } finally {
      setClearing(false);
    }
  }

  return (
    <section aria-labelledby="developer-settings-title">
      <Header
        id="developer-settings-title"
        title={t`Developer`}
        subtitle={t`Activity and diagnostics for this session.`}
      />
      <div className="grid grid-cols-1 gap-section-gap">
        {brokerAvailable && (
          <section aria-labelledby="broker-activity-title">
            <InlineHeader
              id="broker-activity-title"
              title={t`Broker activity`}
              subtitle={t`Running totals from the local relay broker. Updates every 5 seconds.`}
            />
            <SettingsGroup layout="form">
              {stats ? (
                <dl className={styles.metrics}>
                  {(
                    [
                      [t`Queries`, stats.queries],
                      [t`Errors`, stats.errors],
                      [t`Media`, stats.media],
                      [t`Connections`, stats.connects],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-body-sm text-muted">{label}</dt>
                      <dd className="m-0 text-heading tabular-nums">
                        {Number.isFinite(value) ? value.toLocaleString() : "–"}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p role="status" className="m-0 text-body-sm text-muted">
                  {t`Broker stats aren’t available. Start the development relay broker on this origin to view them.`}
                </p>
              )}
            </SettingsGroup>
          </section>
        )}
        {clientMetrics.enabled && <ClientMetricsPanel />}
        <div className="space-y-2">
          <InlineHeader title={t`Runtime settings`} />
          <SettingsGroup layout="form">
            <PreferenceRow
              title={t`Log level`}
              subtitle={t`Saved for this worktree, including browser relay diagnostics.`}
              trailing={
                <Select
                  label={t`Log level`}
                  variant="compact"
                  value={level}
                  disabled={!settingsReady || saving}
                  onValueChange={(value) => void saveLevel(value)}
                  groups={[
                    {
                      label: "",
                      options: Object.keys(LOG_LEVELS).map((value) => ({
                        value,
                        label: value.charAt(0).toUpperCase() + value.slice(1),
                      })),
                    },
                  ]}
                />
              }
            />
            <p className="m-0 text-body-sm text-subtle">
              {t`Info shows lifecycle messages; Debug shows every broker HTTP request and relay WebSocket frame; Trace adds safe protocol metadata. Message bodies and credentials are never included.`}
            </p>
            {settingsError && (
              <p role="alert" className="m-0 text-body-sm text-muted">
                {settingsError}
              </p>
            )}
          </SettingsGroup>
        </div>
        <div className="space-y-2">
          <InlineHeader
            title={t`Agent import`}
            subtitle={t`Simulated findings leave agents unchanged. Real data uses actual imports, even when shown as a new community.`}
          />
          <SettingsGroup layout="form">
            <PreferenceRow
              title={t`What Import finds`}
              trailing={
                <Select
                  label={t`What Import finds`}
                  variant="compact"
                  value={scenario.scenario}
                  onValueChange={(value) => {
                    const next = IMPORT_SCENARIOS.find(
                      (item) => item.value === value,
                    );
                    if (next) setImportScenario({ scenario: next.value });
                  }}
                  groups={[
                    {
                      label: "",
                      options: IMPORT_SCENARIOS.map(({ value, label }) => ({
                        value,
                        label: i18n._(label),
                      })),
                    },
                  ]}
                />
              }
            />
            <SwitchPreferenceRow
              label={t`Show as a new community`}
              description={t`The Agents page shows no agents or teams here, as a first visit would.`}
              checked={scenario.empty}
              onCheckedChange={(empty) => setImportScenario({ empty })}
            />
          </SettingsGroup>
        </div>
        <SettingsGroup layout="form">
          <PreferenceRow
            title={t`Caches`}
            subtitle={t`Clear cached channels, messages, media, and this account’s saved activity in the current community. Turn metrics and your account, relay, and sidebar settings are kept.`}
            trailing={
              <div className={styles.actions}>
                <Button
                  type="button"
                  disabled={clearing}
                  onClick={() => void clearCache()}
                >
                  {clearing ? t`Clearing…` : t`Clear cache`}
                </Button>
              </div>
            }
          />
          {status && (
            <p role="status" className="m-0 text-body-sm text-muted">
              {status}
            </p>
          )}
        </SettingsGroup>
      </div>
    </section>
  );
}
