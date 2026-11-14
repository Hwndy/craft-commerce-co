import { useMutation, useQueryClient, type QueryKey, type UseMutationResult } from "@tanstack/react-query";
import { toast } from "sonner";

export interface UseOptimisticMutationOptions<TData, TVariables, TQueryData> {
  queryKey: QueryKey;
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Derives the next cached value from the previous one and the variables just submitted. */
  updateCache: (previous: TQueryData | undefined, variables: TVariables) => TQueryData;
  /** The error toast's message — T5–T9's own "clear error toasts" requirement. */
  errorMessage: (error: unknown, variables: TVariables) => string;
}

/**
 * The first `useMutation` usage in this codebase — TanStack Query's own
 * standard optimistic-update-with-rollback idiom (onMutate/onError/
 * onSettled), kept domain-agnostic here so T5–T9 can each instantiate it
 * against their own real query/table: a product edit, a photo reorder, an
 * enquiry status change. Errors go through sonner's toast(), matching the
 * convention already used elsewhere (EnquiryForm.tsx, ProductOverlay.tsx)
 * rather than shadcn's own unused use-toast.ts hook.
 */
export function useOptimisticMutation<TData, TVariables, TQueryData>({
  queryKey,
  mutationFn,
  updateCache,
  errorMessage,
}: UseOptimisticMutationOptions<TData, TVariables, TQueryData>): UseMutationResult<TData, unknown, TVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TQueryData>(queryKey);
      queryClient.setQueryData<TQueryData>(queryKey, updateCache(previous, variables));
      return { previous };
    },
    onError: (error, variables, context) => {
      queryClient.setQueryData<TQueryData>(queryKey, (context as { previous?: TQueryData } | undefined)?.previous);
      toast(errorMessage(error, variables));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
