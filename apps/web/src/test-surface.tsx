import { useState } from "react";

export function HarnessDisclosure() {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label="Component test harness">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="harness-detail"
        onClick={() => setOpen((current) => !current)}
      >
        Show harness detail
      </button>
      {open ? (
        <p id="harness-detail" role="status">
          Component harness ready
        </p>
      ) : null}
    </section>
  );
}
