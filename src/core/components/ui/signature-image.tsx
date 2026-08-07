import Image from "next/image";

type Props = {
  src: string;
  alt: string;
  className?: string;
};

export function SignatureImage({ src, alt, className }: Props) {
  return (
    <Image
      src={src}
      alt={alt}
      width={220}
      height={80}
      unoptimized
      className={className}
    />
  );
}
