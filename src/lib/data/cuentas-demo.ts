// Datos de las cuentas de demostración (compartidos entre cliente y servidor).
// Sin "use client": módulo de datos puro, seguro en ambos entornos.

export type Rol = "admin" | "empleado";

/** Correo del administrador de la firma (sembrado). Configurable en .env. */
export const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_FIRM_ADMIN_EMAIL || "admin@hurtadogandini.co")
  .trim()
  .toLowerCase();

/** Contraseña compartida de las cuentas de demostración. */
export const DEMO_PASSWORD = "demo1234";

export interface CuentaDemo {
  email: string;
  nombre: string;
  rol: Rol;
  empresas: string[]; // para admin se expande a todas en el sembrado
}

/** Cuentas sembradas para la demo (admins + empleados con distinto acceso). */
export const CUENTAS_DEMO: CuentaDemo[] = [
  { email: ADMIN_EMAIL, nombre: "Carolina Hurtado", rol: "admin", empresas: [] },
  { email: "daniel.gandini@hurtadogandini.co", nombre: "Daniel Gandini", rol: "admin", empresas: [] },
  { email: "ana.gomez@hurtadogandini.co", nombre: "Ana María Gómez", rol: "empleado", empresas: ["emp-demo", "emp-andina"] },
  { email: "carlos.perez@hurtadogandini.co", nombre: "Carlos Pérez", rol: "empleado", empresas: ["emp-pacifico"] },
];
