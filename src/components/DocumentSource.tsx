"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Badge, Button } from "@/components/ui";
import {
  ACCEPTED_FILE_TYPES,
  extractTextFromFile,
  extractTextFromUrl,
  FileExtractError,
} from "@/lib/extract-file";
import {
  BUCKET_PROVIDERS,
  BucketProvider,
  clearBucketConfig,
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
  Setting2,
  TickCircle,
  CloseCircle,
} from "iconsax-react";

type Modo = "archivo" | "bucket";

// Carga de documentos reutilizable: archivo local (PDF/DOCX/TXT) o el bucket
// propio de la empresa en cualquier nube, configurado vía URL. Devuelve el
// texto extraído al formulario padre a través de onText.
export function DocumentSource({
  onText,
  onBusyChange,
}: {
  onText: (texto: string, fuente: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [modo, setModo] = useState<Modo>("archivo");

  // Estado de carga compartido
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fuente, setFuente] = useState<string | null>(null);

  useEffect(() => onBusyChange?.(cargando), [cargando, onBusyChange]);

  function entregar(texto: string, nombre: string) {
    setFuente(nombre);
    onText(texto, nombre);
  }

  // ── Archivo local ─────────────────────────────────────────────────────────
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function cargarArchivo(file: File) {
    setError(null);
    setCargando(true);
    try {
      const t = await extractTextFromFile(file);
      entregar(t, file.name);
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
    setCargando(true);
    try {
      const url = resolveBucketUrl(cfg, clave);
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

  return (
    <div className="mb-3">
      {/* Selector de origen */}
      <div className="mb-3 flex gap-1">
        <Tab active={modo === "archivo"} onClick={() => { setModo("archivo"); setError(null); }}>
          <DocumentUpload size={14} /> Subir archivo
        </Tab>
        <Tab active={modo === "bucket"} onClick={() => { setModo("bucket"); setError(null); }}>
          <CloudConnection size={14} /> Mi bucket
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
              <TickCircle size={14} variant="Bold" /> Guardar conexión
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
            <div className="flex shrink-0 gap-1">
              <button onClick={abrirEdicion} title="Editar conexión" className="text-ink-3 hover:text-ink">
                <Setting2 size={16} />
              </button>
              <button onClick={desconectar} title="Desconectar bucket" className="text-ink-3 hover:text-red">
                <CloseCircle size={16} />
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              className="ds-field font-mono"
              placeholder="ruta/del/documento.pdf"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") cargarDesdeBucket(); }}
            />
            <Button variant="primary" onClick={cargarDesdeBucket} disabled={cargando}>
              <CloudConnection size={14} variant="Bold" />
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
