"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { setUserProjectAccess } from "./actions";

export function ProjectAccessSelect({
  userId,
  allProjects,
  initialProjectIds,
}: {
  userId: string;
  allProjects: { id: string; name: string }[];
  initialProjectIds: string[];
}) {
  const [selected, setSelected] = useState(new Set(initialProjectIds));
  const [, startTransition] = useTransition();

  function toggle(projectId: string) {
    const next = new Set(selected);
    if (next.has(projectId)) next.delete(projectId);
    else next.add(projectId);
    setSelected(next);
    startTransition(async () => {
      await setUserProjectAccess(userId, [...next]);
    });
  }

  const label =
    selected.size === 0
      ? "No access"
      : selected.size === allProjects.length
        ? "All projects"
        : `${selected.size} project${selected.size === 1 ? "" : "s"}`;

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" className="w-40 justify-between" />}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="size-3.5 opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        <Command>
          <CommandInput placeholder="Search projects…" />
          <CommandList>
            <CommandEmpty>No projects.</CommandEmpty>
            <CommandGroup>
              {allProjects.map((project) => (
                <CommandItem
                  key={project.id}
                  data-checked={selected.has(project.id)}
                  onSelect={() => toggle(project.id)}
                >
                  {project.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
