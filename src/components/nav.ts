import {
  Element4,
  DocumentText,
  Calculator,
  Warning2,
  Judge,
  Convertshape2,
} from "iconsax-react";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof Element4;
  desc: string;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Resumen", icon: Element4, desc: "Panel de compliance" },
  { href: "/contratos", label: "Contratos", icon: DocumentText, desc: "Lectura contractual IA" },
  { href: "/liquidaciones", label: "Liquidaciones", icon: Calculator, desc: "Verificación de prestaciones" },
  { href: "/alertas", label: "Alertas", icon: Warning2, desc: "Vencimientos y obligaciones" },
  { href: "/disciplinario", label: "Disciplinario", icon: Judge, desc: "Debido proceso y pliego" },
  { href: "/reclasificacion", label: "Reclasificación", icon: Convertshape2, desc: "Riesgo de vínculo laboral" },
];
