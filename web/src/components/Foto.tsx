"use client";
import { useState } from "react";
import { Casa } from "./Icones";

interface Props {
  src: string | null | undefined;
  alt: string;
  className?: string;
  prioridade?: boolean;
  sizes?: string;
}

/** Imagem hospedada no site da imobiliária, com reserva quando não carrega. */
export default function Foto({ src, alt, className = "", prioridade }: Props) {
  const [falhou, setFalhou] = useState(false);
  if (!src || falhou) {
    return (
      <div className={`grid place-items-center bg-soft text-muted ${className}`} aria-label="Sem foto">
        <Casa width={32} height={32} strokeWidth={1.5} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fotos vêm de dezenas de domínios externos
    <img
      src={src}
      alt={alt}
      className={className}
      loading={prioridade ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFalhou(true)}
    />
  );
}
