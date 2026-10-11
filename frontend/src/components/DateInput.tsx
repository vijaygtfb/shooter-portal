import { Calendar } from "primereact/calendar";
import { classNames } from "primereact/utils";
import { dateToIso, isoToDate } from "@/lib/dates";

interface DateInputProps {
  id: string;
  value: string | null | undefined;
  onChange: (iso: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
}

/** Calendar that shows DD-MM-YYYY and stores ISO YYYY-MM-DD (REQUIREMENTS §3). */
export function DateInput({ id, value, onChange, onBlur, invalid, disabled, minDate, maxDate }: DateInputProps) {
  return (
    <Calendar
      inputId={id}
      value={isoToDate(value)}
      onChange={(e) => onChange(dateToIso(e.value as Date | null))}
      onHide={onBlur}
      dateFormat="dd-mm-yy"
      placeholder="DD-MM-YYYY"
      showIcon
      showButtonBar
      minDate={isoToDate(minDate) ?? undefined}
      maxDate={isoToDate(maxDate) ?? undefined}
      disabled={disabled}
      className={classNames("w-full", { "p-invalid": invalid })}
      aria-describedby={`${id}-error`}
    />
  );
}
