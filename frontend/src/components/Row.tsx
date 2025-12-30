import React from "react";

interface RowProps {
    k: string;
    v: React.ReactNode;
}

export function Row({ k, v }: RowProps): JSX.Element {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-300">{k}</span>
            <span className="text-neutral-400">{v}</span>
        </div>
    );
}
