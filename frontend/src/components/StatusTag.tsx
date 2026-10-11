import { Tag } from "primereact/tag";
import { STATUS_LABELS, STATUS_SEVERITY, type RegStatus } from "@/features/registration/model";
import { formatDate, isExpired } from "@/lib/dates";

export function StatusTag({ status }: { status: RegStatus }) {
  return <Tag value={STATUS_LABELS[status]} severity={STATUS_SEVERITY[status]} rounded />;
}

export function ExpiryText({ expiresOn }: { expiresOn: string | null }) {
  if (!expiresOn) return <span className="muted">-</span>;
  return (
    <span className="nowrap">
      {formatDate(expiresOn)} {isExpired(expiresOn) && <Tag value="Expired" severity="danger" className="ml-1" />}
    </span>
  );
}
