import {
  Element4,
  DocumentText,
  Calculator,
  Warning2,
  Judge,
  Convertshape2,
  ClipboardText,
  Clock,
  Buildings,
  ShieldTick,
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
  { href: "/recargos", label: "Recargos", icon: Clock, desc: "Horas extra, recargos y licencias" },
  { href: "/aportes", label: "Aportes", icon: ShieldTick, desc: "Seguridad social y provisiones" },
  { href: "/alertas", label: "Alertas", icon: Warning2, desc: "Vencimientos y obligaciones" },
  { href: "/disciplinario", label: "Disciplinario", icon: Judge, desc: "Debido proceso y pliego" },
  { href: "/reclasificacion", label: "Reclasificación", icon: Convertshape2, desc: "Riesgo de vínculo laboral" },
  { href: "/bitacora", label: "Bitácora", icon: ClipboardText, desc: "Trazabilidad de decisiones" },
  { href: "/perfil", label: "Perfil", icon: Buildings, desc: "Documentos normativos internos" },
];
