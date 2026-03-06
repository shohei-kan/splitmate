import { useQuery } from "@tanstack/react-query";
import { fetchSettings } from "../api/settings";
import { qk } from "../lib/queryKeys";

export const DEFAULT_HIGHLIGHT_THRESHOLD = 10000;

export function useSettings() {
  return useQuery({
    queryKey: qk.settings(),
    queryFn: fetchSettings,
    staleTime: 60_000,
  });
}
