/** Vertical stepper for the dark sidebar (docs/ui-reference/04-stepper.png). */
export function Stepper({
  steps,
  active,
  reached,
  onSelect,
}: {
  steps: string[];
  active: number;
  /** Highest step the user has reached; later steps cannot be clicked. */
  reached: number;
  onSelect: (step: number) => void;
}) {
  return (
    <ol className="stepper" aria-label="Application steps">
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n === active ? "active" : n < reached || (n <= reached && n !== active) ? "done" : "todo";
        const clickable = n <= reached && n !== active;
        return (
          <li key={label} className={`stepper-item ${state}`}>
            <button type="button" className="stepper-button" onClick={() => clickable && onSelect(n)} disabled={!clickable} aria-current={n === active ? "step" : undefined}>
              <span className="stepper-circle">{state === "done" ? <i className="pi pi-check" aria-hidden="true" /> : n}</span>
              <span className="stepper-label">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
