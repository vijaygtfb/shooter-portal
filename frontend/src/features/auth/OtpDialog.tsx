import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "primereact/dialog";
import { InputOtp } from "primereact/inputotp";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { errorMessage } from "@/lib/apiClient";
import { config } from "@/config";

interface OtpDialogProps {
  visible: boolean;
  /** What the OTP was sent to, already masked for display. */
  target: string;
  send: () => Promise<{ expires_in: number; resend_in: number; demo_otp?: string }>;
  verify: (otp: string) => Promise<void>;
  onVerified: () => void;
  onHide: () => void;
}

/** InputOtp has no autofocus of its own; focus the first box once the dialog is ready. */
function focusFirstBox() {
  requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".otp-dialog .p-inputotp input")?.focus());
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** OTP popup (REQUIREMENTS §4.1, docs/ui-reference/01-email-otp-popup.png). Sends an OTP as soon as it opens. */
export function OtpDialog({ visible, target, send, verify, onVerified, onHide }: OtpDialogProps) {
  const [otp, setOtp] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [demoOtp, setDemoOtp] = useState<string | undefined>();
  const sentForOpen = useRef(false);

  const doSend = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      const r = await send();
      const sentAt = Date.now();
      setNow(sentAt);
      setExpiresAt(sentAt + r.expires_in * 1000);
      setResendAt(sentAt + r.resend_in * 1000);
      setDemoOtp(r.demo_otp);
      setOtp("");
      focusFirstBox();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }, [send]);

  useEffect(() => {
    if (visible && !sentForOpen.current) {
      sentForOpen.current = true;
      void doSend();
    }
    if (!visible) sentForOpen.current = false;
  }, [visible, doSend]);

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [visible]);

  const expiresIn = Math.max(0, Math.round((expiresAt - now) / 1000));
  const resendIn = Math.max(0, Math.round((resendAt - now) / 1000));

  const onVerify = async () => {
    setVerifying(true);
    setError(null);
    try {
      await verify(otp);
      onVerified();
    } catch (err) {
      setError(errorMessage(err));
      setOtp("");
      focusFirstBox();
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Dialog
      header={
        <span>
          <i className="pi pi-envelope mr-2" aria-hidden="true" />
          Enter OTP
        </span>
      }
      visible={visible}
      onHide={onHide}
      modal
      onShow={focusFirstBox}
      className="otp-dialog"
      style={{ width: "28rem" }}
      breakpoints={{ "640px": "95vw" }}
      footer={
        <p className="otp-footer">
          <i className="pi pi-lock" aria-hidden="true" /> OTP is valid for 10 minutes only
        </p>
      }
    >
      <div className="otp-body">
        <p className="otp-sent">OTP has been sent to</p>
        <p className="otp-target">{target}</p>
        <hr />
        {expiresAt > 0 &&
          (expiresIn > 0 ? (
            <p className="otp-expiry">
              <i className="pi pi-clock" aria-hidden="true" /> Expires in <strong>{mmss(expiresIn)}</strong>
            </p>
          ) : (
            <p className="otp-expiry">This OTP has expired. Please resend.</p>
          ))}
        <InputOtp
          value={otp}
          onChange={(e) => setOtp(String(e.value ?? ""))}
          length={6}
          integerOnly
          className="otp-input"
          aria-label="6-digit OTP"
        />
        {error && <Message severity="error" text={error} className="w-full mt-2" />}
        <Button
          label="Verify OTP"
          icon="pi pi-check"
          severity="success"
          className="w-full mt-3"
          disabled={otp.length !== 6 || expiresIn === 0}
          loading={verifying}
          onClick={onVerify}
        />
        <p className="otp-resend">
          {resendIn > 0 ? (
            <>
              Resend available in <strong>{mmss(resendIn)}</strong>
            </>
          ) : (
            <Button label="Resend OTP" link onClick={doSend} loading={sending} disabled={sending} />
          )}
        </p>
        {config.useMockApi && demoOtp && (
          <p className="demo-hint">
            Demo: use OTP <strong>{demoOtp}</strong>
          </p>
        )}
      </div>
    </Dialog>
  );
}
