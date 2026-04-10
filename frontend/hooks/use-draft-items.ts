import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface DraftItem {
  id: string
  taskId: string
  title: string
  completed: boolean
  issueUrl: string | null
  issueNumber: number | null
  position: number
  createdAt: string
  updatedAt: string
}

export function useDraftItems(taskId: string) {
  return useQuery<DraftItem[]>({
    queryKey: ['draft-items', taskId],
    queryFn: async () => {
      const res = await fetch(`/api/draft-items/${taskId}`)
      if (!res.ok) throw new Error('Failed to fetch draft items')
      return res.json()
    },
    enabled: !!taskId,
  })
}

export function useCreateDraftItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, title, position }: { taskId: string; title: string; position?: number }) => {
      const res = await fetch(`/api/draft-items/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, position }),
      })
      if (!res.ok) throw new Error('Failed to create draft item')
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['draft-items', variables.taskId] })
    },
  })
}

export function useUpdateDraftItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, taskId, ...data }: { itemId: string; taskId: string; title?: string; completed?: boolean; position?: number }) => {
      const res = await fetch(`/api/draft-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update draft item')
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['draft-items', variables.taskId] })
    },
  })
}

export function useDeleteDraftItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId }: { itemId: string; taskId: string }) => {
      const res = await fetch(`/api/draft-items/${itemId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete draft item')
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['draft-items', variables.taskId] })
    },
  })
}

export function useReorderDraftItems() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, itemIds }: { taskId: string; itemIds: string[] }) => {
      const res = await fetch(`/api/draft-items/${taskId}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds }),
      })
      if (!res.ok) throw new Error('Failed to reorder draft items')
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['draft-items', variables.taskId] })
    },
  })
}

export function useSyncDraftToIssues() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/draft-items/${taskId}/sync-issues`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to sync draft items to issues')
      return res.json() as Promise<{ created: number; errors: string[] }>
    },
    onSuccess: (_data, taskId) => {
      queryClient.invalidateQueries({ queryKey: ['draft-items', taskId] })
    },
  })
}
