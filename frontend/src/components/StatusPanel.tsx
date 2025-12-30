import React, { useEffect, useRef, useState } from "react";
import { Row } from "./Row";
import { Badge } from "./Badge";

interface StatusPanelProps {
    state: string;
    jobId: string | null;
    logs: string[];
    artifactPath: string;
}

export function StatusPanel({ state, jobId, logs, artifactPath }: StatusPanelProps): JSX.Element {
    const [progress, setProgress] = useState<number>(0);
    const totalEpochsRef = useRef<number | null>(null);

    useEffect(() => {
        const el = document.getElementById("logs");
        if (el) el.scrollTop = el.scrollHeight;

        // Progress calculation based on logs
        for (const l of logs) {
            const m = l.match(/num epochs .*?:\s*(\d+)/i);
            if (m) totalEpochsRef.current = Number(m[1]);
        }
        const ep = logs.filter((l) => l.toLowerCase().includes("epoch is incremented")).length;
        const total = totalEpochsRef.current ?? 0;
        if (total > 0) setProgress(Math.max(0, Math.min(1, ep / total)));
    }, [logs]);

    return (
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 shadow-sm">
            <h2 className="text-lg font-medium mb-3">Статус</h2>
            <div className="space-y-2 text-sm">
                <Row k="Состояние" v={<Badge>{state.toUpperCase()}</Badge>} />
                <Row k="Job ID" v={jobId || "—"} />
                <div>
                    <div className="text-neutral-300 mb-1">Логи</div>
                    <div
                        id="logs"
                        className="h-48 overflow-auto bg-neutral-950 border border-neutral-800 rounded-xl p-2 text-xs font-mono whitespace-pre-wrap"
                    >
                        {logs.length ? logs.join("\n") : "—"}
                    </div>
                    <div className="mt-2">
                        <div className="text-xs text-neutral-400 mb-1">Progress</div>
                        <div className="h-2 bg-neutral-800 rounded"><div className="h-2 bg-emerald-500 rounded" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
                        <div className="text-right text-xs text-neutral-500 mt-1">{Math.round(progress * 100)}%</div>
                    </div>
                </div>
                <Row
                    k="Артефакт"
                    v={<span className="break-all text-neutral-400 text-xs">{artifactPath || "—"}</span>}
                />
                <div className="mt-3 text-xs text-neutral-400">
                    Подсказки для ED: база <b>dreamshaper_8</b>, Sampler <b>DPM++ 2M Karras</b>, Steps <b>28–40</b>, CFG <b>4–6</b>.
                    Для поз — ControlNet (OpenPose/Depth).
                </div>
            </div>
        </div>
    );
}
