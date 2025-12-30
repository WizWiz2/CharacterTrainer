import React from "react";
import { Field } from "./Field";

export interface TrainingParams {
    name: string;
    trigger: string;
    baseModel: string;
    resolution: number;
    networkDim: number;
    steps: number;
    unetOnly: boolean;
    weight: string;
}

interface TrainingFormProps {
    params: TrainingParams;
    onChange: (params: TrainingParams) => void;
}

export function TrainingForm({ params, onChange }: TrainingFormProps): JSX.Element {
    const update = (key: keyof TrainingParams, value: any) => {
        onChange({ ...params, [key]: value });
    };

    return (
        <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Имя персонажа / ID">
                <input
                    value={params.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="sofia"
                    className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                />
            </Field>
            <Field label="Trigger token">
                <input
                    value={params.trigger}
                    onChange={(e) => update("trigger", e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 w-full"
                />
            </Field>
            <Field label="Базовая модель">
                <select
                    value={params.baseModel}
                    onChange={(e) => update("baseModel", e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 w-full"
                >
                    <option value="dreamshaper_8">dreamshaper_8 (SD1.5)</option>
                    <option value="sd15">SD 1.5 (vanilla)</option>
                </select>
            </Field>
            <Field label="Resolution">
                <input
                    type="number"
                    value={params.resolution}
                    onChange={(e) => update("resolution", Number.parseInt(e.target.value) || 512)}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 w-full"
                />
            </Field>
            <Field label="Network dim">
                <input
                    type="number"
                    value={params.networkDim}
                    onChange={(e) => update("networkDim", Number.parseInt(e.target.value) || 32)}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 w-full"
                />
            </Field>
            <Field label="Steps">
                <input
                    type="number"
                    value={params.steps}
                    onChange={(e) => update("steps", Number.parseInt(e.target.value) || 2500)}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 w-full"
                />
            </Field>
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    checked={params.unetOnly}
                    onChange={(e) => update("unetOnly", e.target.checked)}
                />
                <span className="text-sm">UNet only (рекомендуется на старте)</span>
            </div>
            <Field label="Реком. вес в ED">
                <input
                    value={params.weight}
                    onChange={(e) => update("weight", e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 w-full"
                />
            </Field>
        </div>
    );
}
