import React from "react";

interface BadgeProps {
    children: React.ReactNode;
}

export function Badge({ children }: BadgeProps): JSX.Element {
    return <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-xs">{children}</span>;
}
