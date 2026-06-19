"use client";

// ─────────────────────────────────────────────────────────────────────────
// Autenticación de la firma Hurtado Gandini (correo + contraseña):
//  - Activar administrador → el correo admin (sembrado) fija contraseña + verifica.
//  - Tengo invitación      → un empleado se une con rol y empresas asignadas.
//  - Olvidé mi contraseña  → código por correo + nueva contraseña.
//  - Tras iniciar sesión → selector de empresa cliente (se trabaja una a la vez).
//  - Admin → puede invitar empleados y asignar a qué empresas acceden.
// El código/token se envía por correo (Resend); sin API key se muestra en pantalla.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import {
  useUsuario,
  clearUsuario,
  logAudit,
  FIRMA,
  empresasAccesibles,
  setEmpresaActiva,
  clearEmpresaActiva,
  useEmpresaActiva,
} from "@/lib/store";
import {
  activarAdmin,
  iniciarSesion,
  aceptarInvitacion,
  pedirCodigo,
  confirmarVerificacion,
  confirmarReset,
  invitarUsuario,
  loguear,
} from "@/lib/cuentas";
import { EMPRESAS } from "@/lib/data/empresas";
import { Mark } from "./Logo";
import { Button } from "./ui";
import { ShieldTick, LogoutCurve, ArrowDown2, ArrowLeft2, UserAdd, Copy, Buildings2, ArrowRight2 } from "iconsax-react";

type Modo = "login" | "activar" | "verificar" | "invitacion" | "reset" | "reset-codigo";

const inputCls =
  "w-full border border-border bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-border-2";

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} style={{ borderRadius: "var(--radius)" }} />;
}

function LoginScreen() {
  const [modo, setModo] = useState<Modo>("login");
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [token, setToken] = useState("");
  const [nuevaPass, setNuevaPass] = useState("");
  const [err, setErr] = useState("");
  const [demo, setDemo] = useState("");
  const [msgInfo, setMsgInfo] = useState("");
  const [cargando, setCargando] = useState(false);

  function reset(m: Modo) {
    setModo(m);
    setErr("");
    setDemo("");
    setCodigo("");
    setPassword("");
    setNuevaPass("");
  }

  async function run(fn: () => Promise<void>) {
    setErr("");
    setCargando(true);
    try {
      await fn();
    } catch (e) {
      setErr("Ocurrió un error. Intenta de nuevo.");
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  const onLogin = () =>
    run(async () => {
      const r = await iniciarSesion(email, password);
      if (!r.ok) {
        setErr(r.error || "No se pudo iniciar sesión.");
        if (r.noVerificado) {
          const c = await pedirCodigo(email, nombre, "verificacion");
          if (c.demoCodigo) setDemo(c.demoCodigo);
          setModo("verificar");
        }
      }
    });

  const onActivar = () =>
    run(async () => {
      const r = await activarAdmin({ nombre, email, password });
      if (!r.ok) return setErr(r.error || "No se pudo activar.");
      const c = await pedirCodigo(email, nombre, "verificacion");
      if (!c.ok) return setErr(c.error || "No se pudo enviar el código.");
      if (c.demoCodigo) setDemo(c.demoCodigo);
      setModo("verificar");
    });

  const onVerificar = () =>
    run(async () => {
      const r = await confirmarVerificacion(email, codigo);
      if (!r.ok) return setErr(r.error || "Código incorrecto.");
    });

  const onInvitacion = () =>
    run(async () => {
      const r = await aceptarInvitacion({ token, nombre, password });
      if (!r.ok) return setErr(r.error || "Invitación inválida.");
      if (r.cuenta) loguear(r.cuenta);
    });

  const onResetPedir = () =>
    run(async () => {
      const c = await pedirCodigo(email, "", "reset");
      if (!c.ok) return setErr(c.error || "No se pudo enviar el código.");
      if (c.demoCodigo) setDemo(c.demoCodigo);
      setModo("reset-codigo");
    });

  const onResetConfirmar = () =>
    run(async () => {
      const r = await confirmarReset(email, codigo, nuevaPass);
      if (!r.ok) return setErr(r.error || "No se pudo cambiar la contraseña.");
      reset("login");
      setMsgInfo("Contraseña actualizada. Inicia sesión.");
    });

  const titulo: Record<Modo, string> = {
    login: "Inicia sesión",
    activar: "Activar administrador",
    verificar: "Verifica tu correo",
    invitacion: "Únete con tu invitación",
    reset: "Recuperar contraseña",
    "reset-codigo": "Nueva contraseña",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm border border-border bg-surface p-8" style={{ borderRadius: "var(--radius)" }}>
        <div className="mb-5 flex justify-center">
          <Mark size={44} />
        </div>
        <h1 className="text-center font-display text-[22px] leading-tight text-ink">{titulo[modo]}</h1>
        {modo === "login" && <p className="mt-2 text-center text-[12px] text-ink-3">Centinela · {FIRMA}</p>}

        {msgInfo && modo === "login" && (
          <div className="hairline mt-4 bg-[var(--info-tint)] px-3 py-2 text-[12px] text-ink-2">{msgInfo}</div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {modo === "login" && (
            <>
              <Field type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Field type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button onClick={onLogin} disabled={cargando} className="w-full">
                {cargando ? "Entrando…" : "Entrar"}
              </Button>
              <div className="mt-1 flex flex-col gap-1.5 text-center text-[12px]">
                <button onClick={() => reset("invitacion")} className="text-ink-2 hover:text-ink">
                  Tengo una invitación
                </button>
                <button onClick={() => reset("reset")} className="text-ink-3 hover:text-ink">
                  Olvidé mi contraseña
                </button>
                <button onClick={() => reset("activar")} className="text-ink-3 hover:text-ink">
                  Activar administrador de la firma
                </button>
              </div>
            </>
          )}

          {modo === "activar" && (
            <>
              <p className="text-center text-[12px] text-ink-2">Solo el correo administrador de la firma puede activarse aquí.</p>
              <Field placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <Field type="email" placeholder="Correo del administrador" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Field type="password" placeholder="Crea una contraseña (mín. 6)" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button onClick={onActivar} disabled={cargando} className="w-full">
                {cargando ? "Activando…" : "Activar y verificar"}
              </Button>
              <Atras onClick={() => reset("login")} />
            </>
          )}

          {modo === "verificar" && (
            <>
              <p className="text-center text-[12px] text-ink-2">
                Enviamos un código a <span className="font-medium text-ink">{email}</span>.
              </p>
              <Field placeholder="Código de 6 dígitos" value={codigo} onChange={(e) => setCodigo(e.target.value)} inputMode="numeric" />
              <Button onClick={onVerificar} disabled={cargando} className="w-full">
                {cargando ? "Validando…" : "Validar y entrar"}
              </Button>
              <Atras onClick={() => reset("login")} />
            </>
          )}

          {modo === "invitacion" && (
            <>
              <textarea
                placeholder="Pega aquí tu código de invitación"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                rows={3}
                className={inputCls}
                style={{ borderRadius: "var(--radius)", resize: "none" }}
              />
              <Field placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <Field type="password" placeholder="Crea una contraseña (mín. 6)" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button onClick={onInvitacion} disabled={cargando} className="w-full">
                {cargando ? "Uniéndote…" : "Unirme a la firma"}
              </Button>
              <Atras onClick={() => reset("login")} />
            </>
          )}

          {modo === "reset" && (
            <>
              <Field type="email" placeholder="Tu correo" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button onClick={onResetPedir} disabled={cargando} className="w-full">
                {cargando ? "Enviando…" : "Enviar código"}
              </Button>
              <Atras onClick={() => reset("login")} />
            </>
          )}

          {modo === "reset-codigo" && (
            <>
              <p className="text-center text-[12px] text-ink-2">
                Código enviado a <span className="font-medium text-ink">{email}</span>.
              </p>
              <Field placeholder="Código de 6 dígitos" value={codigo} onChange={(e) => setCodigo(e.target.value)} inputMode="numeric" />
              <Field type="password" placeholder="Nueva contraseña (mín. 6)" value={nuevaPass} onChange={(e) => setNuevaPass(e.target.value)} />
              <Button onClick={onResetConfirmar} disabled={cargando} className="w-full">
                {cargando ? "Guardando…" : "Cambiar contraseña"}
              </Button>
              <Atras onClick={() => reset("login")} />
            </>
          )}
        </div>

        {demo && (
          <div className="hairline mt-4 bg-[var(--info-tint)] px-3 py-2.5 text-center text-[12px] text-ink-2">
            Modo demo (sin servicio de correo). Tu código es:
            <div className="font-num mt-1 text-[18px] font-bold tracking-widest text-ink">{demo}</div>
          </div>
        )}

        {err && <div className="mt-4 hairline bg-[var(--red-tint,#fef2f2)] px-3 py-2 text-[12px] text-[var(--red)]">{err}</div>}

        <div className="hairline mt-6 flex items-start gap-2 bg-surface-2 px-3 py-2.5">
          <ShieldTick size={16} color="var(--success)" variant="Bold" className="mt-0.5 shrink-0" />
          <p className="text-[11px] leading-snug text-ink-2">
            Cada acción quedará firmada con tu nombre y empresa en la bitácora de decisiones.
          </p>
        </div>
      </div>
    </div>
  );
}

function Atras({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-1 flex items-center justify-center gap-1 text-[12px] text-ink-3 hover:text-ink">
      <ArrowLeft2 size={13} color="currentColor" />
      Volver
    </button>
  );
}

// ── Selector de empresa cliente (tras iniciar sesión) ────────────────────────
function SelectorEmpresa() {
  const usuario = useUsuario();
  if (!usuario) return null;
  const empresas = empresasAccesibles(usuario);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <Mark size={36} />
          <button onClick={() => clearUsuario()} className="flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink">
            <LogoutCurve size={14} color="currentColor" /> Cerrar sesión
          </button>
        </div>
        <h1 className="font-display text-[26px] leading-tight text-ink">Elige una empresa cliente</h1>
        <p className="mt-1.5 text-[13px] text-ink-2">
          {usuario.nombre} · {FIRMA} · {usuario.rol === "admin" ? "Admin" : "Empleado"}. Trabajarás una empresa a la vez.
        </p>

        {empresas.length === 0 ? (
          <div className="hairline mt-6 bg-surface-2 px-4 py-6 text-center text-[13px] text-ink-2">
            Aún no tienes empresas asignadas. Pide a un administrador que te dé acceso.
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-2">
            {empresas.map((e) => (
              <button
                key={e.id}
                onClick={() => setEmpresaActiva(e.id)}
                className="hairline group flex items-center gap-3 bg-surface px-4 py-3.5 text-left hover:bg-surface-2"
              >
                <span className="flex h-9 w-9 items-center justify-center bg-black" style={{ borderRadius: "var(--radius)" }}>
                  <Buildings2 size={18} color="#fff" variant="Bold" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ink">{e.nombre}</span>
                  <span className="block text-[11px] text-ink-3">
                    NIT {e.nit} · {e.contratos.length} vínculos
                  </span>
                </span>
                <ArrowRight2 size={16} color="var(--ink-3)" className="transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Compuerta: exige sesión y empresa activa antes de mostrar el panel. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const usuario = useUsuario();
  const empresa = useEmpresaActiva();
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    const marcarMontado = () => setMontado(true);
    marcarMontado();
  }, []);

  if (!montado) return null;
  if (!usuario) return <LoginScreen />;
  if (!empresa) return <SelectorEmpresa />;
  return <>{children}</>;
}

// ── Modal para invitar empleados (solo admin) ────────────────────────────────
function InvitarModal({ onClose }: { onClose: () => void }) {
  const usuario = useUsuario();
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<"admin" | "empleado">("empleado");
  const [empresasSel, setEmpresasSel] = useState<string[]>([]);
  const [token, setToken] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [err, setErr] = useState("");
  const [cargando, setCargando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  if (!usuario) return null;

  function toggle(id: string) {
    setEmpresasSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function onInvitar() {
    setErr("");
    if (rol === "empleado" && empresasSel.length === 0) return setErr("Selecciona al menos una empresa.");
    setCargando(true);
    try {
      const r = await invitarUsuario({
        email,
        rol,
        empresas: rol === "admin" ? [] : empresasSel,
        invitador: usuario!.nombre,
      });
      if (!r.ok) return setErr(r.error || "No se pudo invitar.");
      setToken(r.token || "");
      setEnviado(!!r.enviado);
      logAudit("Empleado invitado", `${email} · rol: ${rol}${rol === "empleado" ? ` · ${empresasSel.length} empresa(s)` : ""}`);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto border border-border bg-surface p-6"
        style={{ borderRadius: "var(--radius)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-[18px] text-ink">Invitar empleado a {FIRMA}</h3>
        <p className="mt-1 text-[12px] text-ink-3">Se enviará un código de invitación al correo.</p>

        {!token ? (
          <div className="mt-4 flex flex-col gap-3">
            <Field type="email" placeholder="Correo del empleado" value={email} onChange={(e) => setEmail(e.target.value)} />
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as "admin" | "empleado")}
              className={inputCls}
              style={{ borderRadius: "var(--radius)" }}
            >
              <option value="empleado">Empleado</option>
              <option value="admin">Administrador</option>
            </select>

            {rol === "empleado" ? (
              <div>
                <div className="overline mb-1.5">Empresas a las que tendrá acceso</div>
                <div className="flex flex-col gap-1">
                  {EMPRESAS.map((e) => (
                    <label key={e.id} className="flex cursor-pointer items-center gap-2 px-1 py-1 text-[13px] text-ink-2">
                      <input type="checkbox" checked={empresasSel.includes(e.id)} onChange={() => toggle(e.id)} />
                      {e.nombre}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-ink-3">Un administrador accede a todas las empresas.</p>
            )}

            <Button onClick={onInvitar} disabled={cargando || !email} className="w-full">
              {cargando ? "Generando…" : "Crear invitación"}
            </Button>
            {err && <div className="text-[12px] text-[var(--red)]">{err}</div>}
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <div className="hairline bg-[var(--info-tint)] px-3 py-2 text-[12px] text-ink-2">
              {enviado ? `Invitación enviada a ${email}.` : "Modo demo: comparte este código con el empleado."}
            </div>
            <div className="hairline break-all bg-surface-2 px-3 py-2 font-mono text-[11px] text-ink-2">{token}</div>
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard?.writeText(token);
                setCopiado(true);
              }}
              className="w-full"
            >
              <Copy size={15} color="currentColor" /> {copiado ? "Copiado" : "Copiar código"}
            </Button>
            <Button onClick={onClose} className="w-full">Listo</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chip de usuario + firma/rol + empresa activa + cerrar sesión ─────────────
export function UserMenu() {
  const usuario = useUsuario();
  const empresa = useEmpresaActiva();
  const [abierto, setAbierto] = useState(false);
  const [invitar, setInvitar] = useState(false);
  if (!usuario) return null;

  const iniciales = usuario.nombre
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative">
      <button onClick={() => setAbierto((v) => !v)} className="flex items-center gap-2 hover:opacity-80" aria-label="Menú de usuario · cerrar sesión">
        <span className="hidden text-right leading-tight sm:block">
          <span className="block max-w-[200px] truncate text-[12px] font-medium text-ink">{usuario.nombre}</span>
          <span className="block max-w-[200px] truncate text-[11px] text-ink-3">
            {FIRMA} · {usuario.rol === "admin" ? "Admin" : "Empleado"}
          </span>
        </span>
        <span className="flex h-8 w-8 items-center justify-center bg-black text-[12px] font-medium text-white" style={{ borderRadius: "var(--radius)" }}>
          {iniciales || "U"}
        </span>
        <ArrowDown2 size={14} color="var(--ink-3)" className={abierto ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-64 border border-border bg-surface p-1 shadow-lg" style={{ borderRadius: "var(--radius)" }}>
            <div className="px-3 py-2.5">
              <div className="truncate text-[13px] font-medium text-ink">{usuario.nombre}</div>
              <div className="truncate text-[11px] text-ink-3">{usuario.email}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="hairline bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-2">{FIRMA}</span>
                <span className="hairline bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-2">
                  {usuario.rol === "admin" ? "Admin" : "Empleado"}
                </span>
              </div>
            </div>
            <div className="my-1 border-t border-border" />

            {empresa && (
              <div className="px-3 py-1.5">
                <div className="text-[10px] uppercase tracking-wide text-ink-3">Empresa activa</div>
                <div className="truncate text-[12px] text-ink">{empresa.nombre}</div>
              </div>
            )}
            <button
              onClick={() => {
                clearEmpresaActiva();
                setAbierto(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink"
              style={{ borderRadius: "var(--radius)" }}
            >
              <Buildings2 size={16} color="currentColor" />
              Cambiar empresa
            </button>

            {usuario.rol === "admin" && (
              <button
                onClick={() => {
                  setInvitar(true);
                  setAbierto(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink"
                style={{ borderRadius: "var(--radius)" }}
              >
                <UserAdd size={16} color="currentColor" />
                Invitar empleado
              </button>
            )}

            <div className="my-1 border-t border-border" />
            <button
              onClick={() => {
                clearUsuario();
                setAbierto(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink"
              style={{ borderRadius: "var(--radius)" }}
            >
              <LogoutCurve size={16} color="currentColor" />
              Cerrar sesión
            </button>
          </div>
        </>
      )}

      {invitar && <InvitarModal onClose={() => setInvitar(false)} />}
    </div>
  );
}
