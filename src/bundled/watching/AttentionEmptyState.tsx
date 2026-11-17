import { useLingui } from "@lingui/react/macro";
import { EmptyState } from "../../shared/design-system/ui/EmptyState";
import { AttentionSonar } from "./AttentionSonar";

export function AttentionEmptyState({
  name,
  picture,
}: {
  name: string;
  picture?: string | undefined;
}) {
  const { t } = useLingui();
  return (
    <section aria-label={t`Start watching`}>
      <EmptyState
        icon={
          <AttentionSonar name={name} picture={picture} size="large" hints />
        }
        title={t`Attention`}
        description={t`Attention lets ${name} watch for messages and updates across Buzz, then act or notify you based on your instructions. Send ${name} a message to get started.`}
      />
    </section>
  );
}
