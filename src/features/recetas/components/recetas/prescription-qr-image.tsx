import Image from "next/image";

type Props = {
  payload: string;
  size?: number;
  className?: string;
};

export function PrescriptionQrImage({ payload, size = 100, className }: Props) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payload)}`;

  return (
    <Image
      src={src}
      alt="Código QR de verificación local"
      width={size}
      height={size}
      unoptimized
      className={className}
    />
  );
}
