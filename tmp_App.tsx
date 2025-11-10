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
  PREVIEW_LIMIT,
  STATUS_POLL_INTERVAL_MS,
} from "./constants";

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
  const [name, setName] = useState("character");
  const [trigger, setTrigger] = useState(DEFAULT_TRIGGER_TOKEN);
  const [baseModel, setBaseModel] = useState(DEFAULT_BASE_MODEL);
  const [resolution, setResolution] = useState(DEFAULT_RESOLUTION);
  const [networkDim, setNetworkDim] = useState(DEFAULT_NETWORK_DIM);
  const [steps, setSteps] = useState(DEFAULT_TRAIN_STEPS);
  const [unetOnly, setUnetOnly] = useState(DEFAULT_UNET_ONLY);
  const [weight, setWeight] = useState(DEFAULT_WEIGHT_HINT);

  const [files, setFiles] = useState<File[]>([]);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const [state, setState] = useState<JobState>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [artifactPath, setArtifactPath] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const logsEndRef = useRef<HTMLDivElement>(null);
  const totalEpochsRef = useRef<number | null>(null);
  const [progress, setProgress] = useState<number>(0);


  const [envChecked, setEnvChecked] = useState(false);
  const [envInfo, setEnvInfo] = useState<EnvInfo>({ ok: false });

  useEffect(() => {
    const urls = files.slice(0, PREVIEW_LIMIT).map((f) => URL.createObjectURL(f));
    setThumbs(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [files]);

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
        pushLog(`${ENV_LOG_PREFIX}${data.ed_lora_dir ?? "not set"}`);
        if (data.message) pushLog(data.message);
      }
    } catch (error) {
      setState("error");
      setErrorMsg(error instanceof Error ? error.message : String(error));
    }
  }

  function pushLog(line: string): void { setLogs((prev)=>[...prev, line]); }

  useEffect(()=>{ const el = document.getElementById("logs"); if(el){ el.scrollTop = el.scrollHeight; }
    for(const l of logs){ const m = l.match(/num epochs .*?:\s*(\d+)/i); if(m){ totalEpochsRef.current = Number(m[1]); } }
    const ep = logs.filter((l)=> l.toLowerCase().includes("epoch is incremented")).length; const total = totalEpochsRef.current ?? 0; if(total>0){ setProgress(Math.max(0, Math.min(1, ep/total))); }
  }, [logs]);

  async function handleStart(): Promise<void> {
    setLogs([]);
    setErrorMsg("");
    setArtifactPath("");
    if (!name.trim()) {
      setErrorMsg(ERROR_NAME_REQUIRED);
      return;
    }
    if (files.length < MIN_REFERENCE_IMAGES) {
      setErrorMsg(ERROR_MIN_IMAGES);
      return;
    }

    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    form.append("name", name.trim());
    form.append("trigger", trigger.trim());
    form.append("base_model", baseModel);
    form.append("resolution", String(resolution));
    form.append("network_dim", String(networkDim));
    form.append("steps", String(steps));
    form.append("unet_only", String(unetOnly));

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

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Character LoRA One‑Click</h1>
            
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={checkEnv}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 hover:border-emerald-500 text-xs"
            >
              Check environment
            </button>
            <span
              className={`text-xs px-2 py-0.5 rounded border ${
                envChecked && envInfo.ok
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
            <h2 className="text-lg font-medium mb-3">Character data</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Character name / ID">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="sofia"
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                />
              </Field>
              <Field label="Trigger token">
                <input
                  value={trigger}
                  onChange={(event) => setTrigger(event.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 w-full"
                />
              </Field>
              <Field label="Base model">
                <select
                  value={baseModel}
                  onChange={(event) => setBaseModel(event.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 w-full"
                >
                  <option value="dreamshaper_8">dreamshaper_8 (SD1.5)</option>
                  <option value="sd15">SD 1.5 (vanilla)</option>
                </select>
              </Field>
              <Field label="Resolution">
                <input
                  type="number"
                  value={resolution}
                  onChange={(event) => setResolution(Number.parseInt(event.target.value) || 512)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 w-full"
                />
              </Field>
              <Field label="Network dim">
                <input
                  type="number"
                  value={networkDim}
                  onChange={(event) => setNetworkDim(Number.parseInt(event.target.value) || 32)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 w-full"
                />
              </Field>
              <Field label="Steps">
                <input
                  type="number"
                  value={steps}
                  onChange={(event) => setSteps(Number.parseInt(event.target.value) || 2500)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 w-full"
                />
              </Field>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={unetOnly} onChange={(event) => setUnetOnly(event.target.checked)} />
                <span className="text-sm">UNet only (recommended when starting)</span>
              </div>
              <Field label="Recommended weight in ED">
                <input
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 w-full"
                />
              </Field>
            </div>

            <div className="mt-4">
              <div className="border border-dashed border-neutral-700 rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
                <p className="text-sm text-neutral-300">Upload 8–25 images (JPG/PNG/WEBP)</p>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition"
                >
                  Choose files
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                />
                {files.length > 0 && <p className="text-xs text-neutral-400">Selected: {files.length}</p>}
              </div>
              {thumbs.length > 0 && (
                <div className="mt-3 grid grid-cols-6 gap-2">
                  {thumbs.map((url, index) => (
                    <img key={index} src={url} className="w-full h-20 object-cover rounded-lg border border-neutral-800" />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleStart}
                disabled={!canStart}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
              >
                ▶︎ Start One‑Click
              </button>
              <button
                onClick={() => {
                  setState("idle");
                  setLogs([]);
                  setJobId(null);
                  setArtifactPath("");
                  setErrorMsg("");
                }}
                className="px-4 py-2 rounded-xl bg-neutral-800 border border-neutral-700"
              >
                Reset
              </button>
            </div>

            {errorMsg && <div className="mt-3 text-sm text-red-400">{errorMsg}</div>}
          </div>

          <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 shadow-sm">
            <h2 className="text-lg font-medium mb-3">Status</h2>
            <div className="space-y-2 text-sm">
              <Row k="State" v={<Badge>{state.toUpperCase()}</Badge>} />
              <Row k="Job ID" v={jobId || "—"} />
              <div>
                <div className="text-neutral-300 mb-1">Logs</div>
                <div className="h-80 overflow-auto bg-neutral-950 border border-neutral-800 rounded-xl p-2 text-xs font-mono whitespace-pre-wrap" id="logs">
                  {logs.length ? logs.join("\n") : "—"}
                </div>
                <div className="mt-2">
                  <div className="text-xs text-neutral-400 mb-1">Progress</div>
                  <div className="h-2 bg-neutral-800 rounded"><div className="h-2 bg-emerald-500 rounded" style={{width: `${Math.round(progress*100)}%`}}/></div>
                  <div className="text-right text-xs text-neutral-500 mt-1">{Math.round(progress*100)}%</div>
                </div>
              </div>
              <Row
                k="Artifact"
                v={<span className="break-all text-neutral-400 text-xs">{artifactPath || "—"}</span>}
              />
              <div className="mt-3 text-xs text-neutral-400">
                Tips for Easy Diffusion: base <b>dreamshaper_8</b>, LoRA weight <b>{weight}</b>, Sampler <b>DPM++ 2M Karras</b>, Steps <b>28–40</b>, CFG <b>4–6</b>.
                For poses use ControlNet (OpenPose/Depth).
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button className="px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-sm">Open LoRA folder</button>
          <button className="px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-sm">Export character passport</button>
          <button className="px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-sm">Generate 3 test scenes</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-neutral-300">{label}</span>
      {children}
    </label>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-neutral-300">{k}</span>
      <span className="text-neutral-400">{v}</span>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }): JSX.Element {
  return <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-xs">{children}</span>;
}








