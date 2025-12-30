export const API_DEFAULT_PREFIX = "/api";
export const API_CONFIG_TEST_PATH = "/config/test";
export const API_TRAIN_PATH = "/train";
export const API_JOBS_PATH = "/jobs";

export const DEFAULT_TRIGGER_TOKEN = "svtchar";
export const DEFAULT_BASE_MODEL = "dreamshaper_8";
export const DEFAULT_RESOLUTION = 512;
export const DEFAULT_NETWORK_DIM = 32;
export const DEFAULT_TRAIN_STEPS = 2500;
export const DEFAULT_UNET_ONLY = true;
export const DEFAULT_WEIGHT_HINT = "0.75";

export const MIN_REFERENCE_IMAGES = 8;
export const PREVIEW_LIMIT = 12;
export const STATUS_POLL_INTERVAL_MS = 1500;

export const LOG_DATASET_PREP = "⏳ Подготовка датасета…";
export const LOG_TRAINING_START = "🚀 Тренировка запущена (kohya_ss)…";
export const ENV_LOG_PREFIX = "ED LoRA dir: ";
export const ENV_NOT_READY_MESSAGE = "Окружение не готово";
export const ERROR_NAME_REQUIRED = "Укажи имя персонажа (ID)";
export const ERROR_MIN_IMAGES = "Загрузите минимум 8 изображений";

export function resolveApiBase(): string {
  const envOverride = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");
  if (envOverride) return envOverride;
  return import.meta.env.DEV ? API_DEFAULT_PREFIX : "";
}

export function apiUrl(path: string): string {
  return `${resolveApiBase()}${path}`;
}
