"use client";
import { useEffect } from "react";
import { registraVisita } from "@/lib/recentes";

export default function RegistraVisita({ id }: { id: number }) {
  useEffect(() => registraVisita(id), [id]);
  return null;
}
