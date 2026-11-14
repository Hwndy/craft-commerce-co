import { useMemo, useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export interface AdminListProps<T> {
  items: T[];
  isLoading?: boolean;
  searchPlaceholder: string;
  getSearchText: (item: T) => string;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onItemClick?: (item: T) => void;
  emptyState: ReactNode;
}

/**
 * T3's generic list+search pattern — domain-agnostic, so T5–T9 each
 * instantiate it against their own real query data (AdminList<ProductRow>,
 * AdminList<EnquiryRow>, ...) rather than this component guessing at any
 * one table's shape. Search is a simple client-side filter over whatever
 * string getSearchText derives from each item — callers decide what's
 * searchable (name, email, slug, ...).
 */
export function AdminList<T>({
  items,
  isLoading,
  searchPlaceholder,
  getSearchText,
  getKey,
  renderItem,
  onItemClick,
  emptyState,
}: AdminListProps<T>) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => getSearchText(item).toLowerCase().includes(term));
  }, [items, search, getSearchText]);

  return (
    <div className="space-y-3">
      <Input
        type="search"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label={searchPlaceholder}
      />
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        emptyState
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => (
            <li key={getKey(item)}>
              {onItemClick ? (
                <button type="button" className="w-full text-left" onClick={() => onItemClick(item)}>
                  {renderItem(item)}
                </button>
              ) : (
                renderItem(item)
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
