"use client";
import { useSyncExternalStore } from "react";
import { Lua, Sol } from "./Icones";

function assinar(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

export default function ThemeToggle() {
  const escuro = useSyncExternalStore(
    assinar,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );

  const alternar = () => {
    const novo = !escuro;
    document.documentElement.classList.toggle("dark", novo);
    try {
      localStorage.setItem("imobiapp:tema", novo ? "escuro" : "claro");
    } catch {
      /* sem armazenamento: só muda a sessão */
    }
  };

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={escuro ? "Usar tema claro" : "Usar tema escuro"}
      title={escuro ? "Tema claro" : "Tema escuro"}
      className="rounded-full border border-line p-2 text-muted transition hover:bg-soft hover:text-fg"
    >
      {escuro ? <Sol /> : <Lua />}
    </button>
  );
}
