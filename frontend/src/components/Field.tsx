import React from "react";

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

export function Field({ label, children }: FieldProps): JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-neutral-300">{label}</span>
      {children}
    </label>
  );
}
