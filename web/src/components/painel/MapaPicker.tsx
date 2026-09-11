"use client";
import dynamic from "next/dynamic";

const MapaPickerLeaflet = dynamic(() => import("./MapaPickerLeaflet"), {
  ssr: false,
  loading: () => <div className="esqueleto h-full w-full" />,
});

export default MapaPickerLeaflet;
