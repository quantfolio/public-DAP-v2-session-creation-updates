import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "./button";

// Button that runs an async handler and shows a spinner while it's in flight.
export function RunButton({
  onRun,
  disabled,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick"> & {
  onRun: () => Promise<unknown> | unknown;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      {...props}
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onRun();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy && <Loader2 className="size-4 animate-spin" />}
      {children}
    </Button>
  );
}
