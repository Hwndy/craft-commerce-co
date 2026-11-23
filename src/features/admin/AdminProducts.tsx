import { ArrowDown, ArrowUp } from "lucide-react";
import { useRef, useState } from "react";

import { formatGbp } from "@/components/brand/ProductLabel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { AdminEditDrawer } from "./components/AdminEditDrawer";
import { AdminList } from "./components/AdminList";
import { ProductForm, type ProductFormHandle } from "./components/ProductForm";
import { useAdminProducts, useReorderProduct, type AdminProductRow } from "./lib/adminProducts";

const STATUS_LABEL: Record<AdminProductRow["status"], string> = {
  available: "Available",
  made_to_order: "Made to order",
  sold: "Sold",
};

/** One drawer "session" per open/new — a fresh random token each time,
 * not the literal `"new"` string. Found in review (CodeRabbit, PR #38):
 * an earlier fix scoped ProductForm's onClose/onCreated callbacks by
 * comparing `current === "new"`/`current === editing`, which still let
 * two *concurrent* "new product" drafts collide — both used the same
 * `"new"` identity, so the first draft's late-resolving create could
 * replace the second draft's own drawer. A real per-session token (not
 * tied to any one product's id, which doesn't exist yet for a draft)
 * closes that gap regardless of how many sessions share the same mode. */
interface EditSession {
  token: string;
  product: AdminProductRow | "new";
}

/**
 * T5's real Products admin (FR-7.2) — replaces AdminSectionPlaceholder.
 * `editing` carries the drawer's whole state: `null` (closed), or an
 * `EditSession` wrapping either `"new"` (ProductForm's no-media create
 * step) or a real AdminProductRow (edit step, media sections included).
 * ProductForm's own `key` below is the session's token, so it remounts
 * fresh with the right defaultValues/schema each time rather than trying
 * to manage a create→edit transition inside one long-lived form instance.
 */
export default function AdminProducts() {
  const { data: products, isLoading, isError, refetch } = useAdminProducts();
  const reorder = useReorderProduct();
  const [editing, setEditing] = useState<EditSession | null>(null);
  const formRef = useRef<ProductFormHandle>(null);

  function moveProduct(id: string, direction: "up" | "down") {
    if (!products) return;
    reorder.mutate({ products, id, direction });
  }

  function openNew() {
    setEditing({ token: crypto.randomUUID(), product: "new" });
  }

  function openEdit(product: AdminProductRow) {
    setEditing({ token: crypto.randomUUID(), product });
  }

  // Dismissing the Sheet by its own X button, Escape or an overlay click
  // all call this with `false` too, not just AdminEditDrawer's own footer
  // actions — found in review (CodeRabbit, PR #38): none of those used to
  // go through ProductForm's own confirmIfDirty() first, so any of them
  // could silently discard an edit in progress.
  function requestClose() {
    if (formRef.current && !formRef.current.confirmClose()) return;
    setEditing(null);
  }

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-heading">Products</h1>
        <Button variant="pill" onClick={openNew}>
          New product
        </Button>
      </div>

      {/* Found in review (CodeRabbit, PR #38): a failed query and a
          genuinely empty one both left `products` undefined/[], so a
          real fetch failure rendered identically to "No products yet" —
          the admin had no way to tell a real problem from an empty
          catalogue. */}
      {isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="text-destructive">Couldn't load products.</p>
          <Button type="button" variant="pill-outline" size="sm" className="mt-2" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        /* No `onItemClick` here: AdminList wraps renderItem's whole output
           in one <button> when it's given one, which would nest the
           reorder buttons below inside it — invalid HTML, and an
           ambiguous click target. Each row owns its own two independent
           click targets instead: the name/details button (opens the edit
           drawer) and the up/down buttons, as plain siblings. */
        <AdminList<AdminProductRow>
          items={products ?? []}
          isLoading={isLoading}
          searchPlaceholder="Search products…"
          getSearchText={(product) => `${product.name} ${product.slug}`}
          getKey={(product) => product.id}
          // A search with no matches isn't the same thing as a genuinely
          // empty catalogue — found in review (CodeRabbit, PR #38).
          emptyState={(search) => (
            <p className="text-sm text-muted-foreground">
              {search ? "No products match your search." : "No products yet."}
            </p>
          )}
          renderItem={(product) => {
            const index = (products ?? []).findIndex((p) => p.id === product.id);
            const isFirst = index === 0;
            const isLast = index === (products?.length ?? 0) - 1;
            return (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEdit(product)}>
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
                    disabled={isFirst || reorder.isPending}
                    onClick={() => moveProduct(product.id, "up")}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="pill-outline"
                    size="icon"
                    aria-label={`Move "${product.name}" down`}
                    disabled={isLast || reorder.isPending}
                    onClick={() => moveProduct(product.id, "down")}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          }}
        />
      )}

      <AdminEditDrawer
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
        title={editing?.product === "new" ? "New product" : editing?.product.name ?? ""}
        description={editing?.product === "new" ? "Add the basic details first — pictures and video come after saving." : undefined}
      >
        {editing !== null && (
          <ProductForm
            ref={formRef}
            key={editing.token}
            product={editing.product === "new" ? undefined : editing.product}
            // mutateAsync() inside ProductForm isn't cancelled when this
            // component unmounts (its own key changes under it, e.g. the
            // admin opened a different product while a save/delete was
            // still in flight) — found in review (CodeRabbit, PR #38): the
            // callback this instance was given still fires once that
            // request settles, so an unconditional setEditing(...) here
            // would close or replace whatever drawer is open *now*, which
            // may belong to a different session with its own unsaved
            // edits. Comparing by this session's own `token` (not the
            // literal `"new"`, which two concurrent create drafts would
            // share — found in review, CodeRabbit, PR #38, as a direct
            // follow-up) is what lets each updater act only if `editing`
            // is still the exact session this closure was created for.
            onCreated={(created) =>
              setEditing((current) => (current?.token === editing.token ? { token: editing.token, product: created } : current))
            }
            onClose={() => setEditing((current) => (current?.token === editing.token ? null : current))}
          />
        )}
      </AdminEditDrawer>
    </main>
  );
}
