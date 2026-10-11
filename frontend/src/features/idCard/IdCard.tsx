import { useState } from "react";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { config } from "@/config";
import { useToast } from "@/components/ToastProvider";
import { formatDate, isExpired } from "@/lib/dates";
import { logger } from "@/lib/logger";
import { DUMMY_PHOTO_URL } from "./dummyPhoto";
import type { IdCardData } from "./idCardData";
import { downloadIdCardPdf } from "./idCardPdf";

/** On-screen preview of the card front, matching the PDF layout. */
export function IdCardPreview({ card }: { card: IdCardData }) {
  return (
    <figure className="id-card" aria-label={`ID card preview for ${card.name}`}>
      <header className="id-card-head">
        <strong>{config.associationName.toUpperCase()}</strong>
        <span>SHOOTER IDENTITY CARD</span>
      </header>
      <div className="id-card-body">
        <img src={DUMMY_PHOTO_URL} alt="Sample photo" className="id-card-photo" />
        <dl className="id-card-fields">
          <div className="span-2">
            <dt>Name</dt>
            <dd className="big">{card.name}</dd>
          </div>
          <div className="span-2">
            <dt>Shooter ID</dt>
            <dd className="id">{card.shooterId}</dd>
          </div>
          <div>
            <dt>Main event</dt>
            <dd>{card.mainEvent}</dd>
          </div>
          <div>
            <dt>Valid till</dt>
            <dd className="expiry">{formatDate(card.expiresOn)}</dd>
          </div>
        </dl>
      </div>
      <div className="id-card-address">
        <span className="id-card-label">Address</span>
        <p>{card.address}</p>
      </div>
      <footer className="id-card-foot" />
    </figure>
  );
}

export function DownloadIdCardButton({ card, label = "Download ID card (PDF)", compact }: { card: IdCardData; label?: string; compact?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    setBusy(true);
    try {
      await downloadIdCardPdf(card);
      logger.info("id card downloaded", { shooterId: card.shooterId });
    } catch (err) {
      logger.error("id card pdf failed", { error: String(err) });
      toast({ severity: "error", summary: "Download failed", detail: "Could not create the ID card PDF. Please try again." });
    } finally {
      setBusy(false);
    }
  };
  return compact ? (
    <Button icon="pi pi-download" rounded text aria-label={`Download ID card for ${card.name}`} tooltip="Download ID card (PDF)" tooltipOptions={{ position: "left" }} onClick={onClick} loading={busy} />
  ) : (
    <Button icon="pi pi-download" label={label} className="btn-primary" onClick={onClick} loading={busy} />
  );
}

export function IdCardPanel({ card }: { card: IdCardData }) {
  const expired = isExpired(card.expiresOn);
  return (
    <section className="card id-card-panel" aria-labelledby="idcard-title">
      <div className="row-between">
        <h3 id="idcard-title" className="section-title">
          ID Card {expired && <Tag value="Expired" severity="danger" className="ml-2" />}
        </h3>
        <DownloadIdCardButton card={card} />
      </div>
      <IdCardPreview card={card} />
      <p className="muted small">
        Issued {formatDate(card.issuedOn)} · valid till {formatDate(card.expiresOn)}. {config.useMockApi && "Demo uses a sample photo."}
      </p>
    </section>
  );
}
