"use client";

import { useRef, useState } from "react";
import { Badge, Button } from "@/components/ui";
import { logAudit } from "@/lib/store";
import {
  DocumentUpload,
  Flash,
  Gallery,
  Microphone2,
  VideoPlay,
  TickCircle,
  Warning2,
  Cpu,
  Trash,
} from "iconsax-react";

// Etapa 4 — Valoración de pruebas (CN art. 29).
// Sube imagen/audio/video y la IA lo transcribe y describe de forma neutral.
// La IA NO valora si prueba la falta: eso lo decide el abogado.

const ACCEPT = "image/*,audio/*,video/*";
const MAX_MB = 18;

interface CtxCaso {
  empleado: string;
  cargo: string;
  hechos: string;
  causal?: string;
}

interface Analisis {
  tipoEvidencia: "imagen" | "audio" | "video";
  transcripcion: string;
  descripcion: string;
  elementosRelevantes: string[];
  relacionConHechos: string;
  calidadYAutenticidad: string;
  observaciones: string;
  confianza: number;
}

interface Respuesta {
  data: Analisis;
  provider?: string;
  model?: string;
  uso?: { tokensEntrada: number; tokensSalida: number; tokensTotal: number; costoUsd: number };
  _modo?: "ia" | "demo" | "error";
  _warning?: string;
}

function iconoModalidad(mime: string) {
  if (mime.startsWith("image/")) return <Gallery size={18} color="var(--red)" variant="Bold" />;
  if (mime.startsWith("audio/")) return <Microphone2 size={18} color="var(--red)" variant="Bold" />;
  if (mime.startsWith("video/")) return <VideoPlay size={18} color="var(--red)" variant="Bold" />;
  return <DocumentUpload size={18} color="var(--red)" />;
}

export function EvidenciaPanel({ caso }: { caso: CtxCaso }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<Respuesta | null>(null);

  function elegir(f: File) {
    setError(null);
    setRes(null);
    if (!/^(image|audio|video)\//.test(f.type)) {
      setError("Tipo no soportado. Suba una imagen, un audio o un video.");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`El archivo supera el límite de ${MAX_MB} MB para análisis inline.`);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function limpiar() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setRes(null);
    setError(null);
  }

  async function analizar() {
    if (!file) return;
    setCargando(true);
    setError(null);
    setRes(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("empleado", caso.empleado);
      fd.append("cargo", caso.cargo);
      fd.append("hechos", caso.hechos);
      if (caso.causal) fd.append("causal", caso.causal);

      const r = await fetch("/api/evidencia", { method: "POST", body: fd });
      const data = (await r.json()) as Respuesta & { error?: string };
      if (!r.ok || data.error) {
        setError(data.error ?? "No se pudo analizar la prueba.");
        return;
      }
      setRes(data);
      logAudit("Prueba analizada (Etapa 4)", `${file.name} · ${caso.empleado} · ${data._modo === "ia" ? data.provider : "demo"}`);
    } catch {
      setError("No se pudo analizar la prueba.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="hairline bg-surface-2 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Cpu size={16} color="var(--red)" />
        <span className="text-[13px] font-medium text-ink">Análisis de pruebas con IA</span>
        <span className="text-[11px] text-ink-3">— transcribe y describe; tú valoras</span>
      </div>
      <p className="mb-3 text-[12px] leading-snug text-ink-2">
        Sube la prueba aportada (imagen, audio o video). La IA la transcribe y describe de forma neutral
        para que puedas <span className="font-medium text-ink">valorarla y controvertirla</span> (CN art. 29).
        La IA no decide si prueba la falta.
      </p>

      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) elegir(f);
        e.target.value = "";
      }} />

      {!file ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastrando(false);
            const f = e.dataTransfer.files?.[0];
            if (f) elegir(f);
          }}
          className={`flex cursor-pointer items-center gap-3 border border-dashed px-4 py-4 text-[12px] transition-colors ${
            arrastrando ? "border-ink bg-surface" : "border-border-2 hover:border-ink"
          }`}
          style={{ borderRadius: "var(--radius)" }}
        >
          <div className="flex gap-1.5">
            <Gallery size={18} color="var(--ink-3)" />
            <Microphone2 size={18} color="var(--ink-3)" />
            <VideoPlay size={18} color="var(--ink-3)" />
          </div>
          <span className="text-ink-2">
            Arrastre o haga clic para subir una <span className="font-medium text-ink">imagen, audio o video</span>
            <span className="text-ink-3"> (máx. {MAX_MB} MB)</span>
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 border border-border-2 px-3 py-2" style={{ borderRadius: "var(--radius)" }}>
            <div className="flex min-w-0 items-center gap-2">
              {iconoModalidad(file.type)}
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-medium text-ink">{file.name}</div>
                <div className="font-num text-[11px] text-ink-3">{(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}</div>
              </div>
            </div>
            <button onClick={limpiar} title="Quitar" className="shrink-0 text-ink-3 hover:text-red">
              <Trash size={16} />
            </button>
          </div>

          {previewUrl && file.type.startsWith("image/") && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Prueba" className="max-h-56 w-auto border border-border-2" style={{ borderRadius: "var(--radius)" }} />
          )}
          {previewUrl && file.type.startsWith("audio/") && (
            <audio src={previewUrl} controls className="w-full" />
          )}
          {previewUrl && file.type.startsWith("video/") && (
            <video src={previewUrl} controls className="max-h-56 w-full border border-border-2" style={{ borderRadius: "var(--radius)" }} />
          )}

          <Button variant="primary" onClick={analizar} disabled={cargando}>
            <Flash size={15} color="currentColor" variant="Bold" /> {cargando ? "Analizando prueba…" : "Analizar con IA"}
          </Button>
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-red-dark">{error}</p>}

      {res && (
        <div className="mt-3 space-y-2.5 border-t border-border pt-3 text-[12.5px]">
          {res._modo === "error" && (
            <p className="text-[11.5px] text-red-dark">La IA falló; mostrando análisis base. {res._warning}</p>
          )}

          {res.data.transcripcion && <Bloque k="Transcripción" v={res.data.transcripcion} mono />}
          <Bloque k="Descripción objetiva" v={res.data.descripcion} />

          {res.data.elementosRelevantes?.length > 0 && (
            <div>
              <span className="overline">Elementos observables</span>
              <ul className="mt-1 space-y-1">
                {res.data.elementosRelevantes.map((el, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-ink-2">
                    <TickCircle size={13} color="var(--ink-3)" className="mt-0.5 shrink-0" /> {el}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Bloque k="Relación con los hechos (descriptiva)" v={res.data.relacionConHechos} />
          <Bloque k="Calidad y autenticidad" v={res.data.calidadYAutenticidad} />

          {res.data.observaciones && (
            <div className="hairline bg-[var(--warning-tint)] px-3 py-2">
              <div className="flex items-start gap-1.5">
                <Warning2 size={13} color="var(--warning)" className="mt-0.5 shrink-0" />
                <span className="text-ink-2"><span className="font-medium text-ink">Para el abogado: </span>{res.data.observaciones}</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge tone={res._modo === "ia" ? "success" : "neutral"}>
              {res._modo === "ia" ? (res.provider ?? "IA") : "Análisis base (sin IA)"}
            </Badge>
            {typeof res.data.confianza === "number" && res._modo === "ia" && (
              <Badge tone="neutral">Confianza {Math.round(res.data.confianza * 100)}%</Badge>
            )}
            {res.uso && (
              <span className="font-num text-[11px] text-ink-3">
                {res.uso.tokensTotal.toLocaleString("es-CO")} tokens · ≈ US${res.uso.costoUsd.toFixed(5)} ({res.model})
              </span>
            )}
          </div>
          <p className="text-[11px] leading-snug text-ink-3">
            Análisis asistido por IA. La valoración de la prueba y su mérito corresponden al abogado responsable.
          </p>
        </div>
      )}
    </div>
  );
}

function Bloque({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  if (!v) return null;
  return (
    <div>
      <span className="overline">{k}</span>
      <p className={`text-ink-2 ${mono ? "whitespace-pre-wrap font-mono text-[11.5px]" : ""}`}>{v}</p>
    </div>
  );
}
