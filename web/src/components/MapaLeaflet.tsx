"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Ponto } from "@/lib/types";
import { fmtArea, fmtPreco, fmtPrecoCurto, rotuloTipo } from "@/lib/format";

export type Bbox = [number, number, number, number]; // sul, oeste, norte, leste

interface Props {
  pontos: Ponto[];
  fin?: string;
  /** Centro fixo (página de detalhe): um marcador só, sem popup. */
  foco?: { lat: number; lng: number; rotulo?: string };
  /** Área atual da busca; quando existe, o mapa não reenquadra os pontos. */
  bbox?: Bbox | null;
  destacado?: number | null;
  aoPassar?: (id: number | null) => void;
  aoClicar?: (id: number) => void;
  /** Usuário arrastou/zoomou o mapa. */
  aoMover?: (bbox: Bbox) => void;
  className?: string;
}

const CENTRO: [number, number] = [-22.4256, -45.4528]; // Itajubá

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function precoDe(p: Ponto, fin: string): number | null {
  if (fin === "aluguel") return p.preco_aluguel;
  if (fin === "venda") return p.preco;
  return p.preco ?? p.preco_aluguel;
}

function popupItem(p: Ponto, fin: string): string {
  const preco = precoDe(p, fin);
  const detalhes = [rotuloTipo(p.tipo), p.quartos ? `${p.quartos} q` : null, p.area ? fmtArea(p.area) : null]
    .filter(Boolean)
    .join(" · ");
  return `<a href="/imovel/${p.id}" style="display:flex;gap:8px;align-items:center;text-decoration:none;color:inherit;padding:4px 0">
    ${p.capa ? `<img src="${esc(p.capa)}" referrerpolicy="no-referrer" style="width:64px;height:48px;object-fit:cover;border-radius:6px;flex:none" alt="">` : ""}
    <span style="min-width:0">
      <strong style="display:block">${esc(fmtPreco(preco))}${fin === "aluguel" ? "/mês" : ""}</strong>
      <span style="display:block;font-size:12px;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(detalhes)}${p.bairro ? ` · ${esc(p.bairro)}` : ""}</span>
    </span></a>`;
}

function paraBbox(b: L.LatLngBounds): Bbox {
  return [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()];
}

export default function MapaLeaflet({ pontos, fin = "venda", foco, bbox, destacado, aoPassar, aoClicar, aoMover, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const camada = useRef<L.LayerGroup | null>(null);
  const porId = useRef(new Map<number, L.Marker>());
  const programatico = useRef(0);
  const cbs = useRef({ aoPassar, aoClicar, aoMover });
  useEffect(() => {
    cbs.current = { aoPassar, aoClicar, aoMover };
  }, [aoPassar, aoClicar, aoMover]);

  useEffect(() => {
    if (!ref.current || mapa.current) return;
    const m = L.map(ref.current, { scrollWheelZoom: !foco, zoomControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    if (foco) m.setView([foco.lat, foco.lng], 15);
    else if (bbox) m.fitBounds(L.latLngBounds([bbox[0], bbox[1]], [bbox[2], bbox[3]]));
    else m.setView(CENTRO, 13);
    camada.current = L.layerGroup().addTo(m);
    mapa.current = m;
    m.on("moveend", () => {
      if (programatico.current > 0) {
        programatico.current--;
        return;
      }
      cbs.current.aoMover?.(paraBbox(m.getBounds()));
    });
    return () => {
      m.remove();
      mapa.current = null;
      camada.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- o mapa é criado uma vez
  }, []);

  useEffect(() => {
    const m = mapa.current;
    const c = camada.current;
    if (!m || !c) return;
    c.clearLayers();
    porId.current.clear();

    if (foco) {
      const icone = L.divIcon({ className: "marcador", html: `<span>${esc(foco.rotulo ?? "Aqui")}</span>`, iconSize: [0, 0] });
      L.marker([foco.lat, foco.lng], { icon: icone }).addTo(c);
      return;
    }

    // Imóveis no mesmo ponto (endereço da imobiliária, geocodificação grosseira) viram um marcador agrupado.
    const grupos = new Map<string, Ponto[]>();
    for (const p of pontos) {
      const k = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
      let g = grupos.get(k);
      if (!g) grupos.set(k, (g = []));
      g.push(p);
    }
    const limites = L.latLngBounds([]);
    for (const g of grupos.values()) {
      const p0 = g[0];
      limites.extend([p0.lat, p0.lng]);
      const html =
        g.length === 1
          ? `<span>${esc(fmtPrecoCurto(precoDe(p0, fin)))}</span>`
          : `<span class="grupo">${g.length} imóveis</span>`;
      const icone = L.divIcon({ className: "marcador", html, iconSize: [0, 0] });
      const mk = L.marker([p0.lat, p0.lng], { icon: icone, riseOnHover: true });
      const corpo = g.slice(0, 25).map((p) => popupItem(p, fin)).join('<hr style="border:0;border-top:1px solid rgba(128,128,128,.25);margin:2px 0">');
      const extra = g.length > 25 ? `<div style="font-size:12px;opacity:.7;padding-top:4px">e mais ${g.length - 25}…</div>` : "";
      mk.bindPopup(`<div style="max-height:260px;overflow:auto;min-width:220px">${corpo}${extra}</div>`, { maxWidth: 320 });
      mk.on("mouseover", () => cbs.current.aoPassar?.(p0.id));
      mk.on("mouseout", () => cbs.current.aoPassar?.(null));
      mk.on("click", () => cbs.current.aoClicar?.(p0.id));
      mk.addTo(c);
      for (const p of g) porId.current.set(p.id, mk);
    }
    if (pontos.length && !bbox) {
      programatico.current++;
      m.fitBounds(limites.pad(0.15), { maxZoom: 16 });
    }
  }, [pontos, fin, foco, bbox]);

  // Destaque vindo da lista (hover no card).
  useEffect(() => {
    if (destacado == null) return;
    const mk = porId.current.get(destacado);
    const el = mk?.getElement()?.querySelector("span");
    if (!mk || !el) return;
    el.classList.add("destaque");
    mk.setZIndexOffset(1000);
    return () => {
      el.classList.remove("destaque");
      mk.setZIndexOffset(0);
    };
  }, [destacado]);

  return <div ref={ref} className={`h-full w-full ${className}`} role="region" aria-label="Mapa dos imóveis" />;
}
