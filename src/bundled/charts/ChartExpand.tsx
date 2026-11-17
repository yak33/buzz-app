import { useLingui } from "@lingui/react/macro";
import { useRef, useState } from "react";
import { ArrowsOutIcon } from "../../shared/design-system/icons";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { Chart } from "./Chart";

/** Opens a chart at full size. The host's copy button copies its fenced JSON. */
export function ChartExpand({ code }: { code: string }) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const expand = useRef<HTMLButtonElement>(null);
  return (
    <>
      <IconButton
        hint="familiar"
        ref={expand}
        aria-label={t`Expand chart`}
        title={t`Expand chart`}
        icon={<ArrowsOutIcon />}
        onClick={() => setOpen(true)}
      />
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t`Chart`}
        size="expanded"
        closeLabel={t`Close chart`}
        finalFocus={expand}
      >
        <Chart code={code} expanded />
      </Dialog>
    </>
  );
}
