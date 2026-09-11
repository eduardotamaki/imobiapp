"use client";
import dynamic from "next/dynamic";

const MapaLeaflet = dynamic(() => import("./MapaLeaflet"), {
  ssr: false,
  loading: () => <div className="esqueleto h-full w-full" />,
});

export default function MapaImovel({ lat, lng, rotulo }: { lat: number; lng: number; rotulo?: string }) {
  return <MapaLeaflet pontos={[]} foco={{ lat, lng, rotulo }} />;
}
