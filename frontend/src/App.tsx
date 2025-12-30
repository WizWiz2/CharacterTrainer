import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  apiUrl,
  API_CONFIG_TEST_PATH,
  API_JOBS_PATH,
  API_TRAIN_PATH,
  DEFAULT_BASE_MODEL,
  DEFAULT_NETWORK_DIM,
  DEFAULT_RESOLUTION,
  DEFAULT_TRAIN_STEPS,
  DEFAULT_TRIGGER_TOKEN,
  DEFAULT_UNET_ONLY,
  DEFAULT_WEIGHT_HINT,
  ENV_LOG_PREFIX,
  ENV_NOT_READY_MESSAGE,
  ERROR_MIN_IMAGES,
  ERROR_NAME_REQUIRED,
  LOG_DATASET_PREP,
  LOG_TRAINING_START,
  MIN_REFERENCE_IMAGES,
  STATUS_POLL_INTERVAL_MS,
  resolveApiBase,
} from "./constants";

import { TrainingForm, TrainingParams } from "./components/TrainingForm";
import { ImageUploader } from "./components/ImageUploader";
import { StatusPanel } from "./components/StatusPanel";
import { Badge } from "./components/Badge";
import { Row } from "./components/Row";
import { Field } from "./components/Field";

type JobState = "idle" | "prepping" | "training" | "copying" | "done" | "error";

interface EnvInfo {
  ok: boolean;
  ed_lora_dir?: string;
  docker?: boolean;
  ssh?: boolean;
  message?: string;
}

interface StatusResponse {
  job_id: string;
  state: string;
  logs: string[];
  artifact_path?: string | null;
  error?: string | null;
}

export default function App(): JSX.Element {
  const [params, setParams] = useState<TrainingParams>({
    name: "",
    trigger: DEFAULT_TRIGGER_TOKEN,
    baseModel: DEFAULT_BASE_MODEL,
    resolution: DEFAULT_RESOLUTION,
    networkDim: DEFAULT_NETWORK_DIM,
    steps: DEFAULT_TRAIN_STEPS,
    unetOnly: DEFAULT_UNET_ONLY,
    weight: DEFAULT_WEIGHT_HINT,
  });

  const [files, setFiles] = useState<File[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [state, setState] = useState<JobState>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [artifactPath, setArtifactPath] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [envChecked, setEnvChecked] = useState(false);
  const [envInfo, setEnvInfo] = useState<EnvInfo>({ ok: false });

  const backendBase = useMemo(() => resolveApiBase().replace(/\/api$/, ""), []);

  async function checkEnv(): Promise<void> {
    setEnvChecked(true);
    setLogs([]);
    setErrorMsg("");
    try {
      const res = await fetch(apiUrl(API_CONFIG_TEST_PATH), { method: "POST" });
      if (!res.ok) throw new Error(`config/test ${res.status}`);
      const data: EnvInfo = await res.json();
      setEnvInfo(data);
      if (!data.ok) {
        setState("error");
        setErrorMsg(data.message || ENV_NOT_READY_MESSAGE);
      } else {
        setState("idle");
        pushLog(`${ENV_LOG_PREFIX}${data.ed_lora_dir ?? "не задан"}`);
        if (data.message) pushLog(data.message);
      }
    } catch (error) {
      setState("error");
      setErrorMsg(error instanceof Error ? error.message : String(error));
    }
  }

  function pushLog(line: string): void {
    setLogs((prev) => [...prev, line]);
  }

  async function handleStart(): Promise<void> {
    setLogs([]);
    setErrorMsg("");
    setArtifactPath("");
    if (!params.name.trim()) {
      setErrorMsg(ERROR_NAME_REQUIRED);
      return;
    }
    if (files.length < MIN_REFERENCE_IMAGES) {
      setErrorMsg(ERROR_MIN_IMAGES);
      return;
    }

    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    form.append("name", params.name.trim());
    form.append("trigger", params.trigger.trim());
    form.append("base_model", params.baseModel);
    form.append("resolution", String(params.resolution));
    form.append("network_dim", String(params.networkDim));
    form.append("steps", String(params.steps));
    form.append("unet_only", String(params.unetOnly));

    try {
      setState("prepping");
      pushLog(LOG_DATASET_PREP);
      const res = await fetch(apiUrl(API_TRAIN_PATH), { method: "POST", body: form });
      if (!res.ok) throw new Error(`/train ${res.status}`);
      const data: { job_id: string } = await res.json();
      setJobId(data.job_id);
      pushLog(LOG_TRAINING_START);
      pollStatus(data.job_id);
    } catch (error) {
      setState("error");
      setErrorMsg(error instanceof Error ? error.message : String(error));
    }
  }

  async function pollStatus(id: string): Promise<void> {
    let stopped = false;

    const poll = async (): Promise<void> => {
      if (stopped) return;
      try {
        const res = await fetch(apiUrl(`${API_JOBS_PATH}/${id}/status`));
        if (!res.ok) throw new Error(`/jobs/${id}/status ${res.status}`);
        const data: StatusResponse = await res.json();
        if (Array.isArray(data.logs)) setLogs(data.logs);
        if (typeof data.state === "string") {
          setState(data.state as JobState);
        }
        if (data.artifact_path) setArtifactPath(data.artifact_path);
        if (data.error) {
          setErrorMsg(data.error);
          setState("error");
          stopped = true;
          return;
        }
        if (data.state === "done" || data.state === "error") {
          stopped = true;
          return;
        }
      } catch (error) {
        setErrorMsg(error instanceof Error ? error.message : String(error));
        setState("error");
        stopped = true;
        return;
      }
      window.setTimeout(poll, STATUS_POLL_INTERVAL_MS);
    };

    void poll();
  }

  const canStart = useMemo(() => state === "idle" || state === "error", [state]);

  const resetState = () => {
    setState("idle");
    setLogs([]);
    setJobId(null);
    setArtifactPath("");
    setErrorMsg("");
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Character LoRA One‑Click</h1>
            <span className="text-xs px-2 py-1 rounded bg-neutral-800 border border-neutral-700">UI Prototype</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={checkEnv}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 hover:border-emerald-500 text-xs"
            >
              Проверить окружение
            </button>
            <span
              className={`text-xs px-2 py-0.5 rounded border ${envChecked && envInfo.ok
                  ? "bg-emerald-900/30 border-emerald-700"
                  : "bg-neutral-800 border-neutral-700"
                }`}
            >
              {envChecked ? (envInfo.ok ? "OK" : "NEEDS SETUP") : "—"}
            </span>
          </div>
        </header>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 shadow-sm">
            <h2 className="text-lg font-medium mb-3">Данные персонажа</h2>

            <TrainingForm params={params} onChange={setParams} />

            <ImageUploader files={files} onFilesChange={setFiles} />

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleStart}
                disabled={!canStart}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
              >
                ▶︎ Запустить One‑Click
              </button>
              <button
                onClick={resetState}
                className="px-4 py-2 rounded-xl bg-neutral-800 border border-neutral-700"
              >
                Сброс
              </button>
            </div>

            {errorMsg && <div className="mt-3 text-sm text-red-400">{errorMsg}</div>}
          </div>

          <StatusPanel
            state={state}
            jobId={jobId}
            logs={logs}
            artifactPath={artifactPath}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <a
            href={`${backendBase}/artifacts/`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-sm"
          >
            Открыть папку LoRA
          </a>
          <button className="px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-sm" onClick={() => {
            const payload = { ...params, recommended_weight: params.weight, artifact: artifactPath || null, generated_at: new Date().toISOString() };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(params.name || 'character').replace(/\s+/g, '_')}_passport.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}>
            Экспорт паспорта персонажа
          </button>
          <button className="px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-sm" onClick={() => {
            const prompts = [`${params.trigger}, ${params.name}, portrait, studio lighting, detailed face`, `${params.trigger}, ${params.name}, close-up, soft light, bokeh background`, `${params.trigger}, ${params.name}, half-body, cinematic light, 85mm`];
            navigator.clipboard.writeText(prompts.map((p, i) => `Scene ${i + 1}: ${p}`).join('\n')).then(() => alert('3 test scenes copied to clipboard')).catch(() => { });
          }}>
            Генерировать 3 тест‑сцены
          </button>
        </div>
      </div>
    </div>
  );
}
