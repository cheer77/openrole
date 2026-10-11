import Image from "next/image";

export function BrandLogo({ eager = false }: { eager?: boolean }) {
  return (
    <Image
      className="brand-logo-image"
      src="/logo/logo.webp"
      alt=""
      width={1588}
      height={384}
      sizes="(max-width: 640px) 130px, 150px"
      loading={eager ? "eager" : "lazy"}
    />
  );
}
