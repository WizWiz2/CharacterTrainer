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

    const logsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = logsRef.current;
        if (el) {
            // Auto-scroll only if user is near bottom (within 50px)
            const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
            if (isNearBottom) {
                el.scrollTop = el.scrollHeight;
            }
        }

        // Progress calculation based on steps (from tqdm output)
        let totalSteps = 0;
        let currentStep = 0;

        for (const l of logs) {
            // Parse total steps: "total optimization steps / 学習ステップ数: 2500"
            const totalMatch = l.match(/total optimization steps.*?:\s*(\d+)/i);
            if (totalMatch) totalSteps = Number(totalMatch[1]);

            // Parse current step: "steps:   1%|          | 29/2500"
            const stepMatch = l.match(/\|\s*(\d+)\/(\d+)/);
            if (stepMatch) {
                currentStep = Math.max(currentStep, Number(stepMatch[1]));
                if (!totalSteps) totalSteps = Number(stepMatch[2]);
            }
        }

        if (totalSteps > 0) {
            setProgress(Math.max(0, Math.min(1, currentStep / totalSteps)));
        }
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
                        ref={logsRef}
                        className="h-96 overflow-y-auto overflow-x-hidden bg-neutral-950 border border-neutral-800 rounded-xl p-2 text-xs font-mono whitespace-pre-wrap break-all"
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
