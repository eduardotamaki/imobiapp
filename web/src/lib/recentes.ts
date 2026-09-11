"use client";
/** Imóveis abertos recentemente (localStorage), para voltar a eles depois. */
import { useSyncExternalStore } from "react";

const CHAVE = "imobiapp:recentes";
const EVENTO = "imobiapp:recentes";
const MAX = 24;
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

export function registraVisita(id: number) {
  try {
    const atual = ler().filter((x) => x !== id);
    localStorage.setItem(CHAVE, JSON.stringify([id, ...atual].slice(0, MAX)));
    window.dispatchEvent(new Event(EVENTO));
  } catch {
    /* sem armazenamento */
  }
}

export function limpaRecentes() {
  try {
    localStorage.removeItem(CHAVE);
    window.dispatchEvent(new Event(EVENTO));
  } catch {
    /* sem armazenamento */
  }
}

function assinar(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENTO, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENTO, cb);
  };
}

export function useRecentes(): number[] {
  return useSyncExternalStore(assinar, ler, () => VAZIO);
}
