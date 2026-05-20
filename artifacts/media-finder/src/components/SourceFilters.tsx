import React from "react";
import { SearchResponseCounts } from "@workspace/api-client-react";

type SourceId = "all" | "google" | "pinterest" | "youtube" | "artstation";

interface SourceFiltersProps {
  counts: SearchResponseCounts;
  activeSource: SourceId;
  onChange: (source: SourceId) => void;
}

export default function SourceFilters({ counts, activeSource, onChange }: SourceFiltersProps) {
  const total = counts.google + counts.pinterest + counts.youtube + counts.artstation;

  const filters = [
    { id: "all" as const, label: "All", count: total },
    { id: "google" as const, label: "Google", count: counts.google },
    { id: "pinterest" as const, label: "Pinterest", count: counts.pinterest },
    { id: "youtube" as const, label: "YouTube", count: counts.youtube },
    { id: "artstation" as const, label: "ArtStation", count: counts.artstation },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map(filter => (
        <button
          key={filter.id}
          onClick={() => onChange(filter.id)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            activeSource === filter.id 
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" 
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-white/5"
          }`}
        >
          {filter.label}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
            activeSource === filter.id ? "bg-black/20" : "bg-black/40 text-muted-foreground"
          }`}>
            {filter.count}
          </span>
        </button>
      ))}
    </div>
  );
}
