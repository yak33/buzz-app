import { useLingui } from "@lingui/react/macro";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ComposerAccessoryProps } from "../../features/conversation/contracts";
import { Button } from "../../shared/design-system/ui/Button";
import { InlineHeader } from "../../shared/design-system/ui/Header";
import { NavigationItem } from "../../shared/design-system/ui/NavigationItem";
import { targetFor } from "./target";
import type { Turn, TurnCheckout, Turns } from "./turns";
import { Counts, totals } from "./Counts";
import styles from "./Changesets.module.css";
import { useLoaded } from "./useLoaded";

const FIRST = 8;

/** Under an agent's last message in a turn: a card for each checkout the turn
 * changed. Nothing for any other message. */
export function TurnCards({
  turns,
  message,
  canOpen,
  open,
}: ComposerAccessoryProps & { turns: Turns }) {
  useSyncExternalStore(turns.subscribe, turns.version);
  useEffect(() => {
    if (message) turns.claim(message);
  });
  const cards = message ? turns.cardsFor(message.id) : [];
  if (!cards.length) return null;
  return (
    <div className={styles.cards}>
      {cards.flatMap((turn) =>
        turn.checkouts.map((checkout, index) =>
          checkout.files ? (
            <ChangesetCard
              key={`${turn.id}:${checkout.dir}:${checkout.prefix}`}
              turns={turns}
              turn={turn}
              checkout={checkout}
              index={index}
              canOpen={canOpen}
              open={open}
            />
          ) : null,
        ),
      )}
    </div>
  );
}

function ChangesetCard({
  turns,
  turn,
  checkout,
  index,
  canOpen,
  open,
}: {
  turns: Turns;
  turn: Turn;
  checkout: TurnCheckout;
  index: number;
  canOpen(target: string): boolean;
  open(target: string): boolean;
}) {
  const { t } = useLingui();
  const [all, setAll] = useState(false);
  const {
    value: files,
    error,
    retry,
  } = useLoaded(() => turns.summary(turn.id, index), [turns, turn.id, index]);
  const shown = files && !all ? files.slice(0, FIRST) : files;
  const sum = files && totals(files);
  const opens = canOpen(targetFor(turn.id, index));
  return (
    <section
      className={styles.card}
      aria-label={t`Changeset: ${checkout.label}`}
    >
      <InlineHeader
        level={4}
        title={checkout.label}
        subtitle={
          files && sum ? (
            <>
              {files.length === 1 ? (
                t`1 file changed`
              ) : (
                t`${files.length} files changed`
              )}{" "}
              <Counts {...sum} />
            </>
          ) : checkout.files === 1 ? (
            t`1 file`
          ) : (
            t`${checkout.files ?? 0} files`
          )
        }
      />
      {checkout.late && (
        <p className={styles.note}>
          {t`Recording began a moment after the agent started, so its first edits may be missing.`}
        </p>
      )}
      {checkout.shared && (
        <p className={styles.note}>
          {t`Another agent was working here too, so some of this may not be this turn's.`}
        </p>
      )}
      {error && (
        <div role="alert" className={styles.note}>
          <p>
            {t`Couldn't read this changeset.`} {error}
          </p>
          {retry && (
            <Button size="sm" variant="ghost" onClick={retry}>
              {t`Try again`}
            </Button>
          )}
        </div>
      )}
      {shown && (
        <ul className={styles.files} aria-label={t`Changed files`}>
          {shown.map((file) => (
            <li key={file.path}>
              <NavigationItem
                variant="row"
                label={file.path}
                title={file.from ? `${file.from} → ${file.path}` : file.path}
                disabled={!opens}
                onClick={() => open(targetFor(turn.id, index, file.path))}
                trailing={file.binary ? t`binary` : <Counts {...file} />}
              />
            </li>
          ))}
        </ul>
      )}
      {files && files.length > FIRST && (
        <Button size="sm" variant="ghost" onClick={() => setAll(!all)}>
          {all ? t`Show fewer` : t`Show all ${files.length} files`}
        </Button>
      )}
    </section>
  );
}
