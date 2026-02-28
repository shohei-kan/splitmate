import { useQuery } from "@tanstack/react-query";
import { fetchSettings } from "../api/settings";

export const DEFAULT_HIGHLIGHT_THRESHOLD = 10000;

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    staleTime: 60_000,
  });
}
