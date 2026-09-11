"use client";
/** Favoritos guardados no navegador (localStorage), com hook reativo. */
import { useSyncExternalStore } from "react";

const CHAVE = "imobiapp:favoritos";
const EVENTO = "imobiapp:favoritos";
let cache: number[] = [];
let cacheBruto: string | null = null;
const VAZIO: number[] = [];

function ler(): number[] {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto === cacheBruto) return cache;
    cacheBruto = bruto;
    const v = bruto ? JSON.parse(bruto) : [];
    cache = Array.isArray(v) ? v.filter((x) => Number.isInteger(x)) : [];
    return cache;
  } catch {
    return VAZIO;
  }
}

function gravar(ids: number[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(ids));
  } catch {
    /* modo privado ou armazenamento bloqueado: segue sem persistir */
  }
  window.dispatchEvent(new Event(EVENTO));
}

function assinar(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENTO, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENTO, cb);
  };
}

export function useFavoritos() {
  const ids = useSyncExternalStore(assinar, ler, () => VAZIO);
  const tem = (id: number) => ids.includes(id);
  const alternar = (id: number) => {
    const atual = ler();
    gravar(atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]);
  };
  const remover = (id: number) => gravar(ler().filter((x) => x !== id));
  const limpar = () => gravar([]);
  return { ids, tem, alternar, remover, limpar };
}
