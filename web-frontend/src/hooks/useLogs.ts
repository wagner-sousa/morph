import { useQuery } from "@tanstack/react-query";
import { api, type LogEntry } from "../lib/api";

export function useLogs(limit = 50) {
  return useQuery<LogEntry[]>({
    queryKey: ["logs", limit],
    queryFn: () => api.logs(limit),
    refetchInterval: 3000,
  });
}
