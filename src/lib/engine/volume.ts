import type { Category } from "./types";

export interface VolumeGroup {
  id: string;
  label: string;
  muscles: string[];
  min: number;
  max: number;
  category: Category | "core";
  sourceIds: string[];
}

// Upper is the priority (growth volume); legs are on maintenance; abs are capped.
export const VOLUME_GROUPS: VolumeGroup[] = [
  { id: "chest", label: "Chest", muscles: ["chest"], min: 10, max: 16, category: "upper", sourceIds: ["schoenfeld2017volume"] },
  { id: "back", label: "Back", muscles: ["lats", "upper_back"], min: 10, max: 16, category: "upper", sourceIds: ["schoenfeld2017volume"] },
  { id: "shoulders", label: "Shoulders", muscles: ["shoulders"], min: 10, max: 16, category: "upper", sourceIds: ["schoenfeld2017volume"] },
  { id: "biceps", label: "Biceps", muscles: ["biceps"], min: 8, max: 14, category: "upper", sourceIds: ["schoenfeld2017volume"] },
  { id: "triceps", label: "Triceps", muscles: ["triceps"], min: 8, max: 14, category: "upper", sourceIds: ["schoenfeld2017volume"] },
  { id: "quads", label: "Quads", muscles: ["quadriceps"], min: 3, max: 6, category: "legs", sourceIds: ["bickel2011"] },
  { id: "hamstrings", label: "Hamstrings", muscles: ["hamstrings", "glutes"], min: 3, max: 6, category: "legs", sourceIds: ["bickel2011"] },
  { id: "abs", label: "Abs", muscles: ["abdominals"], min: 0, max: 8, category: "core", sourceIds: [] },
];

export interface GroupStatus {
  group: VolumeGroup;
  sets: number;
  status: "under" | "ok" | "over";
}

export function groupStatus(vol: Record<string, number>): GroupStatus[] {
  return VOLUME_GROUPS.map((g) => {
    const sets = Math.round(g.muscles.reduce((n, m) => n + (vol[m] ?? 0), 0) * 10) / 10;
    return { group: g, sets, status: sets < g.min ? "under" : sets > g.max ? "over" : "ok" };
  });
}
