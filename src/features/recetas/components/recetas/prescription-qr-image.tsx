"use client";

import QRCode from "react-qr-code";

type Props = {
  payload: string;
  size?: number;
  className?: string;
};

export function PrescriptionQrImage({ payload, size = 100, className }: Props) {
  return (
    <QRCode
      value={payload}
      size={size}
      className={className}
      aria-label="Código QR de verificación local"
    />
  );
}
