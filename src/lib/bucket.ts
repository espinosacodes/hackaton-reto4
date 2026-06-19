// "Bring Your Own Bucket": cada empresa conecta su propio almacenamiento en la
// nube (Amazon S3, Google Cloud Storage, Azure Blob o cualquier URL HTTPS) y
// Centinela lee los documentos directamente desde ahí. La configuración se
// guarda localmente en el navegador (demo); en producción viviría por empresa.

export type BucketProvider = "s3" | "gcs" | "azure" | "custom";

export interface BucketConfig {
  provider: BucketProvider;
  baseUrl: string; // URL base del bucket de la empresa
}

export const BUCKET_PROVIDERS: {
  id: BucketProvider;
  label: string;
  hint: string;
}[] = [
  { id: "s3", label: "Amazon S3", hint: "https://mi-bucket.s3.us-east-1.amazonaws.com/" },
  { id: "gcs", label: "Google Cloud Storage", hint: "https://storage.googleapis.com/mi-bucket/" },
  { id: "azure", label: "Azure Blob Storage", hint: "https://micuenta.blob.core.windows.net/contenedor/" },
  { id: "custom", label: "Otra nube / URL propia", hint: "https://archivos.miempresa.com/docs/" },
];

const STORAGE_KEY = "centinela.bucket";
const CHANGE_EVENT = "centinela.bucket.change";

// Snapshot cacheado para useSyncExternalStore: devuelve la misma referencia
// mientras el contenido en localStorage no cambie (evita renders en bucle).
let cachedRaw: string | null = null;
let cachedCfg: BucketConfig | null = null;

function parse(raw: string | null): BucketConfig | null {
  if (!raw) return null;
  try {
    const cfg = JSON.parse(raw) as BucketConfig;
    return cfg.baseUrl ? cfg : null;
  } catch {
    return null;
  }
}

export function getBucketSnapshot(): BucketConfig | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedCfg = parse(raw);
  }
  return cachedCfg;
}

export function subscribeBucket(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  window.addEventListener(CHANGE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(CHANGE_EVENT, cb);
  };
}

export function saveBucketConfig(cfg: BucketConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearBucketConfig(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Acepta una URL base válida (http/https). Devuelve null si no lo es.
export function normalizeBaseUrl(value: string): string | null {
  const v = value.trim();
  if (!/^https?:\/\//i.test(v)) return null;
  try {
    new URL(v);
  } catch {
    return null;
  }
  return v.endsWith("/") ? v : `${v}/`;
}

// Combina la URL base del bucket con la ruta/clave de un objeto. Si la clave ya
// es una URL completa, se usa tal cual (permite enlaces firmados / públicos).
export function resolveBucketUrl(cfg: BucketConfig, key: string): string {
  const k = key.trim();
  if (/^https?:\/\//i.test(k)) return k;
  const base = cfg.baseUrl.endsWith("/") ? cfg.baseUrl : `${cfg.baseUrl}/`;
  return base + k.replace(/^\/+/, "");
}

export function providerLabel(p: BucketProvider): string {
  return BUCKET_PROVIDERS.find((x) => x.id === p)?.label ?? "Bucket";
}
