"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const CENTRO: [number, number] = [-22.4256, -45.4528]; // Itajubá

interface Props {
  lat: number | null;
  lng: number | null;
  aoMudar: (lat: number, lng: number) => void;
}

/** Mapa para posicionar o imóvel: clique coloca o marcador, arrastar ajusta. */
export default function MapaPickerLeaflet({ lat, lng, aoMudar }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const marcador = useRef<L.Marker | null>(null);
  const cb = useRef(aoMudar);
  useEffect(() => {
    cb.current = aoMudar;
  }, [aoMudar]);

  useEffect(() => {
    if (!ref.current || mapa.current) return;
    const m = L.map(ref.current, { zoomControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    m.setView(lat != null && lng != null ? [lat, lng] : CENTRO, lat != null ? 16 : 13);
    m.on("click", (ev: L.LeafletMouseEvent) => cb.current(ev.latlng.lat, ev.latlng.lng));
    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
      marcador.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- criado uma vez
  }, []);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (lat == null || lng == null) {
      marcador.current?.remove();
      marcador.current = null;
      return;
    }
    if (!marcador.current) {
      const icone = L.divIcon({ className: "marcador", html: "<span>Aqui</span>", iconSize: [0, 0] });
      marcador.current = L.marker([lat, lng], { icon: icone, draggable: true }).addTo(m);
      marcador.current.on("dragend", () => {
        const p = marcador.current!.getLatLng();
        cb.current(p.lat, p.lng);
      });
    } else {
      marcador.current.setLatLng([lat, lng]);
    }
    if (!m.getBounds().contains([lat, lng])) m.panTo([lat, lng]);
  }, [lat, lng]);

  return <div ref={ref} className="h-full w-full" />;
}
