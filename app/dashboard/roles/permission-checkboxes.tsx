"use client";

import { PERMISSIONS } from "@/lib/permissions";

const CATEGORIES = [...new Set(PERMISSIONS.map((p) => p.category))];

export function PermissionCheckboxes({
  name,
  defaultChecked,
  disabled,
}: {
  name: string;
  defaultChecked: string[];
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {CATEGORIES.map((category) => (
        <div key={category} className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {category}
          </p>
          {PERMISSIONS.filter((p) => p.category === category).map((p) => (
            <label
              key={p.key}
              className="flex items-center gap-1.5 text-sm"
            >
              <input
                type="checkbox"
                name={name}
                value={p.key}
                defaultChecked={defaultChecked.includes(p.key)}
                disabled={disabled}
                className="size-3.5 rounded border-input"
              />
              {p.label}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}
