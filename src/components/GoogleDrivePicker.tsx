"use client";

import { useState } from "react";
import { Button, Badge } from "@/components/ui";
import { extractTextFromFile, MAX_FILE_BYTES, FileExtractError } from "@/lib/extract-file";
import { CloudConnection, Document, Setting2, CloseCircle, Folder2 } from "iconsax-react";

// Flujo "Iniciar sesión con Google + Google Picker": el usuario elige su cuenta
// de Gmail, selecciona archivos o sincroniza una carpeta de SU Drive, y Centinela
// lee el documento con el token del propio usuario (no requiere cuenta de servicio).
// La selección la hace el Google Picker (la misma pantalla nativa de Drive).

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "";
const APP_ID = process.env.NEXT_PUBLIC_GOOGLE_APP_ID ?? "";
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";

type DriveDoc = { id: string; name: string; mimeType: string; modifiedTime?: string };

// Carga un <script> externo una sola vez.
const cargados = new Set<string>();
function cargarScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (cargados.has(src)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => { cargados.add(src); resolve(); };
    s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(s);
  });
}

// MIME de exportación para documentos nativos de Google.
const EXPORT: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": { mime: "text/plain", ext: "txt" },
  "application/vnd.google-apps.spreadsheet": { mime: "text/csv", ext: "csv" },
  "application/vnd.google-apps.presentation": { mime: "text/plain", ext: "txt" },
};

export function GoogleDrivePicker({
  onText,
  onBusyChange,
}: {
  onText: (texto: string, fuente: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [cuenta, setCuenta] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveDoc[] | null>(null);
  const [carpeta, setCarpeta] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configurado = Boolean(CLIENT_ID && API_KEY);

  function setBusyState(b: boolean) {
    setBusy(b);
    onBusyChange?.(b);
  }

  async function driveFetch(path: string, tok: string): Promise<Response> {
    return fetch(`https://www.googleapis.com/drive/v3/${path}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
  }

  // 1) Iniciar sesión con Google (elige la cuenta) y obtener el token.
  async function conectar() {
    setError(null);
    try {
      await cargarScript("https://accounts.google.com/gsi/client");
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: async (resp: any) => {
          if (resp.error) {
            setError("No se autorizó el acceso a Google Drive.");
            return;
          }
          const tok = resp.access_token as string;
          setToken(tok);
          // Mostrar la cuenta conectada (Drive about.get → user.emailAddress).
          try {
            const r = await driveFetch("about?fields=user(emailAddress,displayName)", tok);
            const d = await r.json();
            setCuenta(d?.user?.emailAddress ?? "cuenta de Google");
          } catch {
            setCuenta("cuenta de Google");
          }
        },
      });
      tokenClient.requestAccessToken({ prompt: "" });
    } catch {
      setError("No se pudo iniciar sesión con Google.");
    }
  }

  function desconectar() {
    if (token && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(token, () => {});
    }
    setToken(null);
    setCuenta(null);
    setFiles(null);
    setCarpeta(null);
  }

  // 2) Abrir el Google Picker (archivos o carpetas).
  async function abrirPicker(soloCarpetas: boolean) {
    if (!token) return;
    setError(null);
    try {
      await cargarScript("https://apis.google.com/js/api.js");
      await new Promise<void>((res) => window.gapi.load("picker", () => res()));
      const g = window.google;
      const view = new g.picker.DocsView(g.picker.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(soloCarpetas)
        .setMode(g.picker.DocsViewMode.LIST);
      if (soloCarpetas) view.setMimeTypes("application/vnd.google-apps.folder");
      const builder = new g.picker.PickerBuilder()
        .setOAuthToken(token)
        .addView(view)
        .setCallback((data: any) => pickerCallback(data, soloCarpetas))
        .setTitle(soloCarpetas ? "Elige una carpeta para sincronizar" : "Elige un documento");
      if (API_KEY) builder.setDeveloperKey(API_KEY);
      if (APP_ID) builder.setAppId(APP_ID);
      builder.build().setVisible(true);
    } catch {
      setError("No se pudo abrir el selector de Google Drive.");
    }
  }

  async function pickerCallback(data: any, eraCarpeta: boolean) {
    const g = window.google;
    if (data.action !== g.picker.Action.PICKED) return;
    const doc = data.docs?.[0];
    if (!doc) return;
    if (eraCarpeta || doc.type === "folder") {
      setCarpeta({ id: doc.id, name: doc.name });
      sincronizar(doc.id);
    } else {
      cargarDoc({ id: doc.id, name: doc.name, mimeType: doc.mimeType });
    }
  }

  // 3a) Sincronizar una carpeta: lista sus documentos (refleja lo que se suba).
  async function sincronizar(folderId?: string) {
    const id = folderId ?? carpeta?.id;
    if (!id || !token) return;
    setError(null);
    setBusyState(true);
    try {
      const q = encodeURIComponent(`'${id}' in parents and trashed=false`);
      const r = await driveFetch(
        `files?q=${q}&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime desc&pageSize=200`,
        token,
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message ?? "No se pudo leer la carpeta.");
      setFiles((d.files as DriveDoc[]).filter((f) => f.mimeType !== "application/vnd.google-apps.folder"));
    } catch (e) {
      setFiles(null);
      setError(e instanceof Error ? e.message : "No se pudo leer la carpeta de Drive.");
    } finally {
      setBusyState(false);
    }
  }

  // 3b) Cargar y extraer el texto de un documento de Drive.
  async function cargarDoc(f: DriveDoc) {
    if (!token) return;
    setError(null);
    setBusyState(true);
    try {
      const exp = EXPORT[f.mimeType];
      const path = exp
        ? `files/${f.id}/export?mimeType=${encodeURIComponent(exp.mime)}`
        : `files/${f.id}?alt=media`;
      const r = await driveFetch(path, token);
      if (!r.ok) throw new Error("No se pudo descargar el documento.");
      const blob = await r.blob();
      if (blob.size > MAX_FILE_BYTES) throw new FileExtractError("El documento supera el límite de 12 MB.");
      const nombre = exp && !/\.[a-z0-9]+$/i.test(f.name) ? `${f.name}.${exp.ext}` : f.name;
      const file = new File([blob], nombre, { type: blob.type });
      const texto = await extractTextFromFile(file);
      onText(texto, f.name);
    } catch (e) {
      setError(e instanceof FileExtractError || e instanceof Error ? e.message : "No se pudo leer el documento.");
    } finally {
      setBusyState(false);
    }
  }

  if (!configurado) {
    return (
      <div className="hairline bg-[var(--warning-tint)] px-3 py-2.5 text-[12px] leading-snug text-ink-2">
        El inicio de sesión con Google aún no está configurado (falta el OAuth Client ID). Mientras tanto,
        use “Mi bucket” con un enlace público.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!token ? (
        <>
          <p className="text-[11.5px] leading-snug text-ink-2">
            Inicia sesión con tu cuenta de Google y elige los documentos directamente de tu Drive
            (no tienes que descargar nada ni copiar enlaces).
          </p>
          <Button variant="primary" onClick={conectar}>
            <CloudConnection size={15} color="currentColor" variant="Bold" /> Iniciar sesión con Google
          </Button>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 border border-border-2 px-3 py-2" style={{ borderRadius: "var(--radius)" }}>
            <div className="flex min-w-0 items-center gap-2">
              <CloudConnection size={16} color="var(--success)" variant="Bold" className="shrink-0" />
              <Badge tone="success">Conectado</Badge>
              <span className="truncate text-[11.5px] text-ink-2">{cuenta}</span>
            </div>
            <button onClick={desconectar} className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-ink-3 hover:text-red">
              <CloseCircle size={14} /> Salir
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => abrirPicker(false)} disabled={busy}>
              <Document size={14} color="var(--red)" /> Elegir archivo
            </Button>
            <Button variant="secondary" onClick={() => abrirPicker(true)} disabled={busy}>
              <Folder2 size={14} color="var(--red)" /> Elegir carpeta (sincronizar)
            </Button>
            {carpeta && (
              <button onClick={() => sincronizar()} disabled={busy} className="inline-flex items-center gap-1 text-[11.5px] text-ink-2 hover:text-ink">
                <Setting2 size={14} /> {busy ? "Sincronizando…" : `Sincronizar «${carpeta.name}»`}
              </button>
            )}
          </div>

          {files && files.length === 0 && (
            <p className="text-[12px] text-ink-3">La carpeta no tiene documentos legibles.</p>
          )}
          {files && files.length > 0 && (
            <div className="hairline max-h-56 divide-y divide-border overflow-y-auto">
              {files.map((f) => (
                <button
                  key={f.id}
                  onClick={() => cargarDoc(f)}
                  disabled={busy}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors hover:bg-surface-2"
                >
                  <Document size={15} color="var(--red)" className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
                  {f.modifiedTime && (
                    <span className="shrink-0 text-[10.5px] text-ink-3">
                      {new Date(f.modifiedTime).toLocaleDateString("es-CO")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {error && <p className="text-[12px] text-red-dark">{error}</p>}
    </div>
  );
}
