import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { useOptimisticMutation } from "./useOptimisticMutation";

interface Item {
  id: string;
  name: string;
}

const QUERY_KEY = ["items"];

afterEach(() => {
  vi.clearAllMocks();
});

function withQueryClient(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useOptimisticMutation", () => {
  it("applies the optimistic update immediately, before mutationFn resolves", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData<Item[]>(QUERY_KEY, [{ id: "1", name: "Original" }]);

    let resolveMutation: (value: Item) => void = () => {};
    const mutationFn = vi.fn(
      () =>
        new Promise<Item>((resolve) => {
          resolveMutation = resolve;
        })
    );

    const { result } = renderHook(
      () =>
        useOptimisticMutation<Item, Item, Item[]>({
          queryKey: QUERY_KEY,
          mutationFn,
          updateCache: (previous, variables) =>
            (previous ?? []).map((item) => (item.id === variables.id ? variables : item)),
          errorMessage: () => "Couldn't save the change.",
        }),
      { wrapper: withQueryClient(queryClient) }
    );

    act(() => {
      result.current.mutate({ id: "1", name: "Updated" });
    });

    await waitFor(() => expect(queryClient.getQueryData<Item[]>(QUERY_KEY)).toEqual([{ id: "1", name: "Updated" }]));
    expect(mutationFn).toHaveBeenCalledWith({ id: "1", name: "Updated" });

    resolveMutation({ id: "1", name: "Updated" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("rolls back the cache and shows an error toast when mutationFn rejects", async () => {
    const queryClient = new QueryClient();
    const original: Item[] = [{ id: "1", name: "Original" }];
    queryClient.setQueryData<Item[]>(QUERY_KEY, original);

    const mutationFn = vi.fn().mockRejectedValue(new Error("network error"));

    const { result } = renderHook(
      () =>
        useOptimisticMutation<Item, Item, Item[]>({
          queryKey: QUERY_KEY,
          mutationFn,
          updateCache: (previous, variables) =>
            (previous ?? []).map((item) => (item.id === variables.id ? variables : item)),
          errorMessage: () => "Couldn't save the change.",
        }),
      { wrapper: withQueryClient(queryClient) }
    );

    act(() => {
      result.current.mutate({ id: "1", name: "Updated" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData<Item[]>(QUERY_KEY)).toEqual(original);
    expect(toastMock).toHaveBeenCalledWith("Couldn't save the change.");
  });

  it("invalidates the query on success, so the cache reconciles with the server", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData<Item[]>(QUERY_KEY, [{ id: "1", name: "Original" }]);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const mutationFn = vi.fn().mockResolvedValue({ id: "1", name: "Updated" });

    const { result } = renderHook(
      () =>
        useOptimisticMutation<Item, Item, Item[]>({
          queryKey: QUERY_KEY,
          mutationFn,
          updateCache: (previous, variables) =>
            (previous ?? []).map((item) => (item.id === variables.id ? variables : item)),
          errorMessage: () => "Couldn't save the change.",
        }),
      { wrapper: withQueryClient(queryClient) }
    );

    act(() => {
      result.current.mutate({ id: "1", name: "Updated" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEY });
  });
});
