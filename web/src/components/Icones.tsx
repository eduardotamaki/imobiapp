import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});

export const Cama = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18h18M5 10V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M9 10V8h6v2" />
  </svg>
);
export const Banho = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM6 12V5a2 2 0 0 1 4 0M7 20l-1 1M17 20l1 1" />
  </svg>
);
export const Carro = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 17h14M5 17a2 2 0 0 1-2-2v-3l2-5h14l2 5v3a2 2 0 0 1-2 2M7 17v2M17 17v2M7 13h.01M17 13h.01" />
  </svg>
);
export const Regua = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 8l13-5 5 13-13 5zM8 6l1.5 4M11 5l1.5 4M14 4l1.5 4" />
  </svg>
);
export const Coracao = (p: P & { cheio?: boolean }) => {
  const { cheio, ...r } = p;
  return (
    <svg {...base(r)} fill={cheio ? "currentColor" : "none"}>
      <path d="M12 21s-7-4.6-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.4-9.5 9-9.5 9z" />
    </svg>
  );
};
export const Pino = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 22s7-7.1 7-12a7 7 0 1 0-14 0c0 4.9 7 12 7 12z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);
export const Externo = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
  </svg>
);
export const Grade = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
export const Lista = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
export const Mapa = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" />
  </svg>
);
export const Lupa = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);
export const Sol = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
export const Lua = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);
export const Fechar = (p: P) => (
  <svg {...base(p)}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
export const Seta = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const Filtro = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 5h18l-7 8v6l-4 2v-8z" />
  </svg>
);
export const Baixar = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v12M6 11l6 6 6-6M4 21h16" />
  </svg>
);
export const Casa = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6" />
  </svg>
);
export const Tendencia = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 17l6-6 4 4 8-8M14 7h7v7" />
  </svg>
);
