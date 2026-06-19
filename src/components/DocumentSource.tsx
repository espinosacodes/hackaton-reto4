"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Badge, Button } from "@/components/ui";
import { GoogleDrivePicker } from "@/components/GoogleDrivePicker";
import {
  ACCEPTED_FILE_TYPES,
  extractTextFromFile,
  extractTextFromUrl,
  extractTextFromDriveFile,
  FileExtractError,
} from "@/lib/extract-file";
import {
  BUCKET_PROVIDERS,
  BucketProvider,
  clearBucketConfig,
  driveDirectUrl,
  esCarpetaDrive,
  getBucketSnapshot,
  normalizeBaseUrl,
  providerLabel,
  resolveBucketUrl,
  saveBucketConfig,
  subscribeBucket,
} from "@/lib/bucket";
import {
  DocumentUpload,
  Flash,
  Document,
  CloudConnection,
  Cloud,
  Setting2,
  TickCircle,
  CloseCircle,
} from "iconsax-react";

type Modo = "archivo" | "bucket" | "drive";

type DriveFile = { id: string; name: string; mimeType: string; modifiedTime?: string; esCarpeta: boolean };
const DRIVE_FOLDER_KEY = "centinela:drive-folder";

// Carga de documentos reutilizable: archivo local (PDF/DOCX/TXT) o el bucket
// propio de la empresa en cualquier nube, configurado vía URL. Devuelve el
// texto extraído al formulario padre a través de onText.
export function DocumentSource({
  onText,
  onBusyChange,
}: {
  // archivo: documento ORIGINAL (cuando la fuente lo aporta) para archivarlo en S3.
  onText: (texto: string, fuente: string, archivo?: File) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [modo, setModo] = useState<Modo>("archivo");

  // Estado de carga compartido
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fuente, setFuente] = useState<string | null>(null);

  useEffect(() => onBusyChange?.(cargando), [cargando, onBusyChange]);

  function entregar(texto: string, nombre: string, archivo?: File) {
    setFuente(nombre);
    onText(texto, nombre, archivo);
  }

  // ── Archivo local ─────────────────────────────────────────────────────────
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function cargarArchivo(file: File) {
    setError(null);
    setCargando(true);
    try {
      const t = await extractTextFromFile(file);
      entregar(t, file.name, file);
    } catch (err) {
      setFuente(null);
      setError(err instanceof FileExtractError ? err.message : "No se pudo procesar el archivo.");
    } finally {
      setCargando(false);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) cargarArchivo(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setArrastrando(false);
    const file = e.dataTransfer.files?.[0];
    if (file) cargarArchivo(file);
  }

  // ── Bucket de la empresa ────────────────────────────────────────────────────
  // La config vive en localStorage (por empresa). useSyncExternalStore evita el
  // desfase de hidratación y mantiene la UI sincronizada entre pestañas.
  const cfg = useSyncExternalStore(subscribeBucket, getBucketSnapshot, () => null);
  const [editando, setEditando] = useState(false);
  const [draftProvider, setDraftProvider] = useState<BucketProvider>("s3");
  const [draftUrl, setDraftUrl] = useState("");
  const [clave, setClave] = useState("");

  // Form de configuración visible mientras no haya bucket o se esté editando.
  const editing = editando || !cfg;

  function abrirEdicion() {
    if (cfg) {
      setDraftProvider(cfg.provider);
      setDraftUrl(cfg.baseUrl);
    }
    setEditando(true);
  }

  function guardarConfig() {
    const base = normalizeBaseUrl(draftUrl);
    if (!base) {
      setError("La URL del bucket no es válida. Use una URL http(s) completa.");
      return;
    }
    saveBucketConfig({ provider: draftProvider, baseUrl: base });
    setEditando(false);
    setError(null);
  }

  function desconectar() {
    clearBucketConfig();
    setEditando(false);
    setClave("");
  }

  async function cargarDesdeBucket() {
    if (!cfg) return;
    if (!clave.trim()) {
      setError("Indique la ruta o nombre del documento dentro del bucket.");
      return;
    }
    setError(null);
    const resuelta = resolveBucketUrl(cfg, clave);
    if (esCarpetaDrive(resuelta)) {
      setError(
        "Ese es un enlace de CARPETA de Drive: no se puede leer un archivo desde ahí. Abra el documento en Drive, use “Compartir → Cualquiera con el enlace” y pegue el enlace del ARCHIVO.",
      );
      return;
    }
    const url = driveDirectUrl(resuelta);
    setCargando(true);
    try {
      const t = await extractTextFromUrl(url);
      entregar(t, clave.trim());
    } catch (err) {
      setFuente(null);
      setError(err instanceof FileExtractError ? err.message : "No se pudo leer el documento del bucket.");
    } finally {
      setCargando(false);
    }
  }

  const hint = BUCKET_PROVIDERS.find((p) => p.id === draftProvider)?.hint ?? "";

  // ── Google Drive por API (cuenta de servicio) ───────────────────────────────
  const [driveInfo, setDriveInfo] = useState<{ configured: boolean; email: string } | null>(null);
  const [folderInput, setFolderInput] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFile[] | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);

  // Al abrir la pestaña de Drive: consulta si la conexión está configurada y
  // recupera la última carpeta usada. (Async para no llamar setState de forma
  // síncrona dentro del efecto.)
  useEffect(() => {
    if (modo !== "drive" || driveInfo) return;
    let cancelado = false;
    (async () => {
      const d = await fetch("/api/drive").then((r) => r.json()).catch(() => ({}));
      if (cancelado) return;
      setDriveInfo({ configured: !!d.configured, email: d.serviceAccountEmail ?? "" });
      const saved = typeof window !== "undefined" ? localStorage.getItem(DRIVE_FOLDER_KEY) : null;
      if (saved && d.configured) {
        setFolderInput(saved);
        setFolderId(saved);
        sincronizarDrive(saved); // lista de inmediato la carpeta recordada
      }
    })();
    return () => { cancelado = true; };
  }, [modo, driveInfo]);

  // Lista (o re-lista, "sincroniza") los archivos de la carpeta conectada.
  async function sincronizarDrive(id?: string) {
    const target = id ?? folderId;
    if (!target) return;
    setError(null);
    setDriveBusy(true);
    try {
      const r = await fetch(`/api/drive?folderId=${encodeURIComponent(target)}`);
      const d = await r.json();
      if (!r.ok) throw new FileExtractError(d.error ?? "No se pudo leer la carpeta de Drive.");
      setDriveFiles((d.files as DriveFile[]).filter((f) => !f.esCarpeta));
    } catch (err) {
      setDriveFiles(null);
      setError(err instanceof FileExtractError ? err.message : "No se pudo leer la carpeta de Drive.");
    } finally {
      setDriveBusy(false);
    }
  }

  function conectarCarpeta() {
    const id = folderInput.trim();
    if (!id) {
      setError("Pegue el enlace o el id de la carpeta de Drive.");
      return;
    }
    if (typeof window !== "undefined") localStorage.setItem(DRIVE_FOLDER_KEY, id);
    setFolderId(id);
    sincronizarDrive(id);
  }

  function desconectarDrive() {
    if (typeof window !== "undefined") localStorage.removeItem(DRIVE_FOLDER_KEY);
    setFolderId(null);
    setDriveFiles(null);
    setFolderInput("");
  }

  async function cargarDriveFile(f: DriveFile) {
    setError(null);
    setCargando(true);
    try {
      const t = await extractTextFromDriveFile(f.id, f.name);
      entregar(t, f.name);
    } catch (err) {
      setFuente(null);
      setError(err instanceof FileExtractError ? err.message : "No se pudo leer el documento de Drive.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="mb-3">
      {/* Selector de origen */}
      <div className="mb-3 flex gap-1">
        <Tab active={modo === "archivo"} onClick={() => { setModo("archivo"); setError(null); }}>
          <DocumentUpload size={14} color="var(--red)" variant="Bold" /> Subir archivo
        </Tab>
        <Tab active={modo === "drive"} onClick={() => { setModo("drive"); setError(null); }}>
          <DriveLogo size={14} /> Google Drive
        </Tab>
        <Tab active={modo === "bucket"} onClick={() => { setModo("bucket"); setError(null); }}>
          <Cloud size={14} color="var(--red)" variant="Bold" /> Mi bucket
        </Tab>
      </div>

      {modo === "archivo" ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={onPickFile}
            className="hidden"
          />
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={onDrop}
            className={`flex cursor-pointer items-center gap-3 border border-dashed px-4 py-3 text-[12px] transition-colors ${
              arrastrando ? "border-ink bg-surface-2" : "border-border-2 hover:border-ink"
            }`}
            style={{ borderRadius: "var(--radius)" }}
          >
            {cargando ? (
              <>
                <Flash size={18} color="var(--red)" variant="Bold" className="animate-pulse" />
                <span className="text-ink-2">Leyendo archivo…</span>
              </>
            ) : fuente ? (
              <>
                <Document size={18} color="var(--success)" variant="Bold" />
                <span className="text-ink">
                  <span className="font-medium">{fuente}</span> cargado · texto extraído abajo
                </span>
              </>
            ) : (
              <>
                <DocumentUpload size={18} color="var(--red)" />
                <span className="text-ink-2">
                  Arrastre o haga clic para subir un <span className="font-medium text-ink">PDF, DOCX o TXT</span>
                </span>
              </>
            )}
          </div>
        </>
      ) : modo === "drive" ? (
        // Google Drive — primario: iniciar sesión con Google + Picker.
        <div className="space-y-3">
          <GoogleDrivePicker onText={entregar} onBusyChange={setCargando} />

          {/* Avanzado: conexión por cuenta de servicio (la firma comparte su carpeta). */}
          <details className="text-[12px]">
            <summary className="cursor-pointer text-ink-3 hover:text-ink">
              Avanzado · conectar una carpeta compartida con la cuenta de servicio
            </summary>
            <div className="mt-2 space-y-2">
          {driveInfo && !driveInfo.configured ? (
            <div className="hairline bg-[var(--warning-tint)] px-3 py-2.5 text-[12px] leading-snug text-ink-2">
              La cuenta de servicio no está configurada en el servidor.
            </div>
          ) : (
            <>
              <div className="hairline bg-surface-2 px-3 py-2.5 text-[11.5px] leading-snug text-ink-2">
                Comparta su carpeta de Drive (rol <span className="font-medium">Lector</span>) con:
                <span className="mt-0.5 block break-all font-mono text-[11px] text-ink">
                  {driveInfo?.email || "…"}
                </span>
                Luego pegue el enlace de la carpeta. Centinela mostrará lo que se suba (use “Sincronizar”).
              </div>

              {!folderId ? (
                <div className="flex gap-2">
                  <input
                    className="ds-field font-mono"
                    placeholder="https://drive.google.com/drive/folders/…"
                    value={folderInput}
                    onChange={(e) => setFolderInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") conectarCarpeta(); }}
                  />
                  <Button variant="primary" onClick={conectarCarpeta} disabled={driveBusy}>
                    <CloudConnection size={14} color="currentColor" variant="Bold" /> Conectar
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 border border-border-2 px-3 py-2" style={{ borderRadius: "var(--radius)" }}>
                    <div className="flex min-w-0 items-center gap-2">
                      <CloudConnection size={16} color="var(--success)" variant="Bold" className="shrink-0" />
                      <span className="truncate font-mono text-[11px] text-ink-3">{folderId}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => sincronizarDrive()}
                        disabled={driveBusy}
                        className="inline-flex items-center gap-1 text-[11.5px] text-ink-2 hover:text-ink"
                        title="Volver a leer la carpeta (ver lo nuevo que se subió)"
                      >
                        <Setting2 size={14} /> {driveBusy ? "Sincronizando…" : "Sincronizar"}
                      </button>
                      <button onClick={desconectarDrive} className="inline-flex items-center gap-1 text-[11.5px] text-ink-3 hover:text-red">
                        <CloseCircle size={14} /> Quitar
                      </button>
                    </div>
                  </div>

                  {driveFiles && driveFiles.length === 0 && (
                    <p className="text-[12px] text-ink-3">La carpeta no tiene archivos legibles (o aún no se comparte con la cuenta de servicio).</p>
                  )}
                  {driveFiles && driveFiles.length > 0 && (
                    <div className="hairline max-h-56 divide-y divide-border overflow-y-auto">
                      {driveFiles.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => cargarDriveFile(f)}
                          disabled={cargando}
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
            </>
          )}
            </div>
          </details>
          {fuente && !cargando && (
            <div className="flex items-center gap-2 text-[12px] text-ink">
              <Document size={15} color="var(--success)" variant="Bold" />
              <span className="font-medium">{fuente}</span> cargado desde Drive
            </div>
          )}
        </div>
      ) : editing ? (
        // Configuración del bucket de la empresa
        <div className="space-y-2 border border-border-2 px-4 py-3" style={{ borderRadius: "var(--radius)" }}>
          <div className="flex items-center gap-2 text-[12px] text-ink-2">
            <Setting2 size={15} color="var(--red)" />
            Conecte el almacenamiento de su empresa (cualquier nube)
          </div>
          <select
            className="ds-field"
            value={draftProvider}
            onChange={(e) => setDraftProvider(e.target.value as BucketProvider)}
          >
            {BUCKET_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <input
            className="ds-field font-mono"
            placeholder={hint}
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
          />
          <p className="text-[11px] text-ink-3">
            URL base del bucket. Centinela leerá los documentos directamente desde su nube; no se copian a nuestros servidores.
          </p>
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" onClick={guardarConfig}>
              <TickCircle size={14} color="currentColor" variant="Bold" /> Guardar conexión
            </Button>
            {cfg && (
              <Button variant="secondary" onClick={() => { setEditando(false); setError(null); }}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      ) : (
        // Carga desde el bucket ya conectado
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 border border-border-2 px-3 py-2" style={{ borderRadius: "var(--radius)" }}>
            <div className="flex min-w-0 items-center gap-2">
              <CloudConnection size={16} color="var(--success)" variant="Bold" className="shrink-0" />
              <div className="min-w-0">
                <Badge tone="success">{providerLabel(cfg!.provider)}</Badge>
                <div className="truncate font-mono text-[11px] text-ink-3">{cfg!.baseUrl}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button onClick={abrirEdicion} title="Editar conexión" className="text-ink-3 hover:text-ink">
                <Setting2 size={16} />
              </button>
              <button
                onClick={desconectar}
                title="Quitar la conexión del bucket"
                className="inline-flex items-center gap-1 text-[11.5px] text-ink-3 hover:text-red"
              >
                <CloseCircle size={14} /> Quitar
              </button>
            </div>
          </div>
          {cfg!.provider === "drive" && (
            <p className="text-[11px] text-ink-3">
              Pegue el enlace del <span className="font-medium">archivo</span> de Drive (no de la carpeta),
              compartido como “Cualquiera con el enlace”.
            </p>
          )}
          <div className="flex gap-2">
            <input
              className="ds-field font-mono"
              placeholder={cfg!.provider === "drive" ? "https://drive.google.com/file/d/…/view" : "ruta/del/documento.pdf"}
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") cargarDesdeBucket(); }}
            />
            <Button variant="primary" onClick={cargarDesdeBucket} disabled={cargando}>
              <CloudConnection size={14} color="currentColor" variant="Bold" />
              {cargando ? "Cargando…" : "Cargar"}
            </Button>
          </div>
          {fuente && !cargando && (
            <div className="flex items-center gap-2 text-[12px] text-ink">
              <Document size={15} color="var(--success)" variant="Bold" />
              <span className="font-medium">{fuente}</span> cargado desde su bucket
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-red-dark">{error}</p>}

      <style jsx global>{`
        .ds-field {
          width: 100%;
          border: 1px solid var(--border-2);
          background: var(--surface);
          padding: 7px 9px;
          font-size: 12.5px;
          color: var(--ink);
          border-radius: var(--radius);
        }
        .ds-field:focus { outline: none; border-color: var(--ink); }
      `}</style>
    </div>
  );
}

// Logo de marca de Google Drive (tricolor). iconsax no trae logos de marca, así
// que lo dibujamos como SVG con los colores oficiales.
function DriveLogo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="shrink-0">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 border px-3 py-1.5 text-[12px] font-medium transition-colors"
      style={{
        borderRadius: "var(--radius)",
        background: active ? "var(--surface-2)" : "transparent",
        borderColor: active ? "var(--ink)" : "var(--border-2)",
        color: active ? "var(--ink)" : "var(--ink-3)",
      }}
    >
      {children}
    </button>
  );
}
