"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function AssigneeMultiSelect({
  name,
  assignees,
  selected,
  onChange,
}: {
  name: string;
  assignees: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-input p-2">
      {assignees.length === 0 && (
        <p className="px-1 py-1 text-sm text-muted-foreground">No teammates yet.</p>
      )}
      {assignees.map((a) => {
        const checked = selected.includes(a.id);
        return (
          <label
            key={a.id}
            className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted"
          >
            <input
              type="checkbox"
              className="size-3.5"
              checked={checked}
              onChange={() =>
                onChange(
                  checked ? selected.filter((id) => id !== a.id) : [...selected, a.id]
                )
              }
            />
            <Avatar size="sm">
              <AvatarFallback>{a.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            {a.name}
            {checked && <input type="hidden" name={name} value={a.id} />}
          </label>
        );
      })}
    </div>
  );
}
