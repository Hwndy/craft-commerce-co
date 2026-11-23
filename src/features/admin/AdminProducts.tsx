import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";

import { formatGbp } from "@/components/brand/ProductLabel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { AdminEditDrawer } from "./components/AdminEditDrawer";
import { AdminList } from "./components/AdminList";
import { ProductForm } from "./components/ProductForm";
import { useAdminProducts, useReorderProduct, type AdminProductRow } from "./lib/adminProducts";

const STATUS_LABEL: Record<AdminProductRow["status"], string> = {
  available: "Available",
  made_to_order: "Made to order",
  sold: "Sold",
};

/**
 * T5's real Products admin (FR-7.2) — replaces AdminSectionPlaceholder.
 * `editing` carries the drawer's whole state: `null` (closed), `"new"`
 * (ProductForm's no-media create step), or a real AdminProductRow (edit
 * step, media sections included). ProductForm's own `key` below changes
 * across these, so it remounts fresh with the right defaultValues/schema
 * each time rather than trying to manage a create→edit transition inside
 * one long-lived form instance.
 */
export default function AdminProducts() {
  const { data: products, isLoading } = useAdminProducts();
  const reorder = useReorderProduct();
  const [editing, setEditing] = useState<AdminProductRow | "new" | null>(null);

  function moveProduct(id: string, direction: "up" | "down") {
    if (!products) return;
    reorder.mutate({ products, id, direction });
  }

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-heading">Products</h1>
        <Button variant="pill" onClick={() => setEditing("new")}>
          New product
        </Button>
      </div>

      {/* No `onItemClick` here: AdminList wraps renderItem's whole output in
          one <button> when it's given one, which would nest the reorder
          buttons below inside it — invalid HTML, and an ambiguous click
          target. Each row owns its own two independent click targets
          instead: the name/details button (opens the edit drawer) and the
          up/down buttons, as plain siblings. */}
      <AdminList<AdminProductRow>
        items={products ?? []}
        isLoading={isLoading}
        searchPlaceholder="Search products…"
        getSearchText={(product) => `${product.name} ${product.slug}`}
        getKey={(product) => product.id}
        emptyState={<p className="text-sm text-muted-foreground">No products yet.</p>}
        renderItem={(product) => {
          const index = (products ?? []).findIndex((p) => p.id === product.id);
          const isFirst = index === 0;
          const isLast = index === (products?.length ?? 0) - 1;
          return (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(product)}>
                <p className="truncate font-medium">{product.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatGbp(product.priceAmount)} · {product.zone} · {STATUS_LABEL[product.status]}
                  {!product.published && " · Unpublished"}
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                {product.onSale && <Badge variant="secondary">Sale</Badge>}
                <Button
                  type="button"
                  variant="pill-outline"
                  size="icon"
                  aria-label={`Move "${product.name}" up`}
                  disabled={isFirst}
                  onClick={() => moveProduct(product.id, "up")}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="pill-outline"
                  size="icon"
                  aria-label={`Move "${product.name}" down`}
                  disabled={isLast}
                  onClick={() => moveProduct(product.id, "down")}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        }}
      />

      <AdminEditDrawer
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={editing === "new" ? "New product" : editing ? editing.name : ""}
        description={editing === "new" ? "Add the basic details first — pictures and video come after saving." : undefined}
      >
        {editing !== null && (
          <ProductForm
            key={editing === "new" ? "new" : editing.id}
            product={editing === "new" ? undefined : editing}
            onCreated={(created) => setEditing(created)}
            onClose={() => setEditing(null)}
          />
        )}
      </AdminEditDrawer>
    </main>
  );
}
