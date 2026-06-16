import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type MCPConfig, type MCPStatus } from '../lib/api';

export function useMcps() {
  return useQuery<MCPStatus[]>({
    queryKey: ['mcps'],
    queryFn: api.mcps,
    refetchInterval: 5000,
  });
}

export function useMcp(name: string) {
  return useQuery<MCPStatus>({
    queryKey: ['mcps', name],
    queryFn: () => api.mcp(name),
    enabled: !!name,
  });
}

export function useAddMcp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cfg: MCPConfig) => api.addMcp(cfg),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcps'] }),
  });
}

export function useUpdateMcp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, cfg }: { name: string; cfg: Partial<MCPConfig> }) => api.updateMcp(name, cfg),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcps'] }),
  });
}

export function useDeleteMcp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.deleteMcp(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcps'] }),
  });
}

export function useRestartMcp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.restartMcp(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcps'] }),
  });
}
