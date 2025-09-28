import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Character LoRA One‑Click — UI Prototype (wired to API contracts)
 *
 * Assumptions:
 *  - TailwindCSS is available.
 *  - Backend provides endpoints:
 *    POST /train (multipart: files[] + params JSON fields)
 *    GET  /jobs/{id}/status  → { state, logs: string[], artifact_path?, error? }
 *    POST /config/test       → { ok, ed_lora_dir, docker?, ssh?, message? }
 *
 * Replace fetch URLs if your API is mounted under a prefix.
 */

export default function App() {
  // Form state
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("svtchar");
  const [baseModel, setBaseModel] = useState("dreamshaper_8"); // SD1.5 family
  const [resolution, setResolution] = useState(512);
  const [networkDim, setNetworkDim] = useState(32);
  const [steps, setSteps] = useState(2500);
  const [unetOnly, setUnetOnly] = useState(true);
  const [weight, setWeight] = useState("0.75");

  // Files
  const [files, setFiles] = useState<File[]>([]);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Job state
  const [jobId, setJobId] = useState<string | null>(null);
  const [state, setState] = useState<"idle"|"prepping"|"training"|"copying"|"done"|"error">("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [artifactPath, setArtifactPath] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Env check
  const [envChecked, setEnvChecked] = useState(false);
  const [envInfo, setEnvInfo] = useState<{ok:boolean; ed_lora_dir?:string; docker?:boolean; ssh?:boolean; message?:string}>({ok:false});

  function pushLog(line: string) { setLogs(prev => [...prev, line]); }

  // Generate thumbnails for UX
  useEffect(() => {
    const urls = files.slice(0, 12).map(f => URL.createObjectURL(f));
    setThumbs(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [files]);

  async function checkEnv() {
    setEnvChecked(true);
    setLogs([]); setErrorMsg("");
    try {
      const res = await fetch("/config/test", { method: "POST" });
      const data = await res.json();
      setEnvInfo(data);
      if (!data.ok) {
        setState("error");
        setErrorMsg(data.message || "Окружение не готово");
      } else {
        pushLog(`ED LoRA dir: ${data.ed_lora_dir}`);
      }
    } catch (e:any) {
      setState("error");
      setErrorMsg(e?.message || String(e));
    }
  }

  async function handleStart() {
    setLogs([]); setErrorMsg(""); setArtifactPath("");
    if (!name.trim()) { setErrorMsg("Укажи имя персонажа (ID)"); return; }
    if (files.length < 8) { setErrorMsg("Загрузите минимум 8 изображений"); return; }

    const form = new FormData();
    files.forEach(f => form.append("files", f));
    form.append("name", name.trim());
    form.append("trigger", trigger.trim());
    form.append("base_model", baseModel);
    form.append("resolution", String(resolution));
    form.append("network_dim", String(networkDim));
    form.append("steps", String(steps));
    form.append("unet_only", String(unetOnly));

    try {
      setState("prepping");
      pushLog("⏳ Подготовка датасета…");
      const res = await fetch("/train", { method: "POST", body: form });
      if (!res.ok) throw new Error(`/train ${res.status}`);
      const data = await res.json();
      setJobId(data.job_id);
      pushLog("🚀 Тренировка запущена (kohya_ss)…");
      pollStatus(data.job_id);
    } catch (e:any) {
      setState("error");
      setErrorMsg(e?.message || String(e));
    }
  }

  // Polling loop
  async function pollStatus(id: string) {
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/jobs/${id}/status`);
        const data = await res.json();
        // push incremental logs
        if (Array.isArray(data.logs)) setLogs(data.logs);
        if (data.state) setState(data.state);
        if (data.artifact_path) setArtifactPath(data.artifact_path);
        if (data.error) { setErrorMsg(data.error); setState("error"); stopped = true; return; }
        if (data.state === "done" || data.state === "error") { stopped = true; return; }
      } catch (e:any) {
        setErrorMsg(e?.message || String(e));
        setState("error");
        stopped = true;
        return;
      }
      setTimeout(poll, 1500);
    };
    poll();
  }

  const canStart = useMemo(() => (state === "idle" || state === "error"), [state]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Character LoRA One‑Click</h1>
            <span className="text-xs px-2 py-1 rounded bg-neutral-800 border border-neutral-700">UI Prototype</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={checkEnv} className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 hover:border-emerald-500 text-xs">Проверить окружение</button>
            <span className={`text-xs px-2 py-0.5 rounded border ${envInfo.ok?"bg-emerald-900/30 border-emerald-700":"bg-neutral-800 border-neutral-700"}`}>
              {envInfo.ok?"OK":"NEEDS SETUP"}
            </span>
          </div>
        </header>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Left: Form */}
          <div className="lg:col-span-2 bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 shadow-sm">
            <h2 className="text-lg font-medium mb-3">Данные персонажа</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Имя персонажа / ID">
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="sofia"
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500 w-full" />
              </Field>
              <Field label="Trigger token">
                <input value={trigger} onChange={e=>setTrigger(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 w-full" />
              </Field>
              <Field label="Базовая модель">
                <select value={baseModel} onChange={e=>setBaseModel(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 w-full">
                  <option value="dreamshaper_8">dreamshaper_8 (SD1.5)</option>
                  <option value="sd15">SD 1.5 (vanilla)</option>
                </select>
              </Field>
              <Field label="Resolution">
                <input type="number" value={resolution} onChange={e=>setResolution(parseInt(e.target.value)||512)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 w-full" />
              </Field>
              <Field label="Network dim">
                <input type="number" value={networkDim} onChange={e=>setNetworkDim(parseInt(e.target.value)||32)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 w-full" />
              </Field>
              <Field label="Steps">
                <input type="number" value={steps} onChange={e=>setSteps(parseInt(e.target.value)||2500)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 w-full" />
              </Field>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={unetOnly} onChange={e=>setUnetOnly(e.target.checked)} />
                <span className="text-sm">UNet only (рекомендуется на старте)</span>
              </div>
              <Field label="Реком. вес в ED">
                <input value={weight} onChange={e=>setWeight(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 w-full" />
              </Field>
            </div>

            {/* File drop */}
            <div className="mt-4">
              <div className="border border-dashed border-neutral-700 rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
                <p className="text-sm text-neutral-300">Загрузите 8–25 изображений (JPG/PNG/WEBP)</p>
                <button onClick={()=>inputRef.current?.click()} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition">Выбрать файлы</button>
                <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={e=>setFiles(Array.from(e.target.files||[]))} />
                {files.length>0 && (
                  <p className="text-xs text-neutral-400">Выбрано: {files.length}</p>
                )}
              </div>
              {thumbs.length>0 && (
                <div className="mt-3 grid grid-cols-6 gap-2">
                  {thumbs.map((u,i)=> (
                    <img key={i} src={u} className="w-full h-20 object-cover rounded-lg border border-neutral-800" />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={handleStart} disabled={!canStart}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">
                ▶︎ Запустить One‑Click
              </button>
              <button onClick={()=>{setState("idle"); setLogs([]); setJobId(null); setArtifactPath(""); setErrorMsg("");}}
                className="px-4 py-2 rounded-xl bg-neutral-800 border border-neutral-700">Сброс</button>
            </div>

            {!!errorMsg && (
              <div className="mt-3 text-sm text-red-400">{errorMsg}</div>
            )}
          </div>

          {/* Right: Status */}
          <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 shadow-sm">
            <h2 className="text-lg font-medium mb-3">Статус</h2>
            <div className="space-y-2 text-sm">
              <Row k="Состояние" v={<Badge>{state.toUpperCase()}</Badge>} />
              <Row k="Job ID" v={jobId || "—"} />
              <div>
                <div className="text-neutral-300 mb-1">Логи</div>
                <div className="h-48 overflow-auto bg-neutral-950 border border-neutral-800 rounded-xl p-2 text-xs font-mono whitespace-pre-wrap">
                  {logs.length? logs.join("\n") : "—"}
                </div>
              </div>
              <Row k="Артефакт" v={<span className="break-all text-neutral-400 text-xs">{artifactPath || "—"}</span>} />
              <div className="mt-3 text-xs text-neutral-400">
                Подсказки для ED: база <b>dreamshaper_8</b>, LoRA‑вес <b>{weight}</b>, Sampler <b>DPM++ 2M Karras</b>,
                Steps <b>28–40</b>, CFG <b>4–6</b>. Для поз — ControlNet (OpenPose/Depth).
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-wrap gap-2">
          <button className="px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-sm">Открыть папку LoRA</button>
          <button className="px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-sm">Экспорт паспорта персонажа</button>
          <button className="px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-sm">Генерировать 3 тест‑сцены</button>
        </div>
      </div>
    </div>
  );
}

function Field({label, children}:{label:string; children:React.ReactNode}){
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-neutral-300">{label}</span>
      {children}
    </label>
  );
}

function Row({k, v}:{k:string; v:React.ReactNode}){
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-neutral-300">{k}</span>
      <span className="text-neutral-400">{v}</span>
    </div>
  );
}

function Badge({children}:{children:React.ReactNode}){
  return (
    <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-xs">{children}</span>
  );
}
