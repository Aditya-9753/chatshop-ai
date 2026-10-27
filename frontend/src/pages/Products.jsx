import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LayoutGrid, List, MoreHorizontal, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import productService from "../services/product.service";
import { assetUrl } from "../config/api.config";
import { useToast } from "../components/Toast";
import {
  Badge,
  Button,
  Card,
  cn,
  ConfirmDialog,
  DataTable,
  DropdownContent,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusPill,
} from "../components/ui";
import ProductFormModal from "../features/products/ProductFormModal";
import { formatCurrency } from "../utils/format";

const LOW_STOCK = 5;
const VIEW_KEY = "products-view";

export const stockStatus = (stock = 0) => (stock <= 0 ? "out of stock" : stock <= LOW_STOCK ? "low stock" : "in stock");

const STOCK_FILTERS = [
  { value: "", label: "All stock" },
  { value: "in", label: "In stock" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
];

const filterClass = "h-9 rounded-lg border border-line bg-surface px-2 text-sm text-fg outline-none focus:border-accent";

function Thumb({ product, className }) {
  const src = product.images?.[0];
  return (
    <span className={cn("flex items-center justify-center overflow-hidden bg-surface-2", className)}>
      {src ? (
        <img src={assetUrl(src)} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <Package className="h-5 w-5 text-fg-subtle" aria-hidden="true" />
      )}
    </span>
  );
}

function Price({ product }) {
  return (
    <span className="tabular-nums">
      <span className="font-semibold text-fg">{formatCurrency(product.price)}</span>
      {product.comparePrice > product.price && (
        <span className="ml-1.5 text-caption text-fg-muted line-through">{formatCurrency(product.comparePrice)}</span>
      )}
    </span>
  );
}

function ProductCard({ product, onEdit, onDelete }) {
  return (
    <Card className="group relative flex flex-col overflow-hidden transition-colors hover:border-line-strong">
      <button onClick={() => onEdit(product)} className="text-left" aria-label={`Edit ${product.name}`}>
        <Thumb product={product} className="aspect-square w-full border-b border-line" />
      </button>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-fg">{product.name}</p>
            <p className="truncate text-xs text-fg-muted">{product.category || "Uncategorised"}</p>
          </div>
          <DropdownMenu>
            <DropdownTrigger asChild>
              <Button variant="ghost" size="icon-sm" icon={MoreHorizontal} aria-label={`Actions for ${product.name}`} />
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem icon={Pencil} onSelect={() => onEdit(product)}>
                Edit
              </DropdownItem>
              <DropdownItem icon={Trash2} danger onSelect={() => onDelete(product)}>
                Delete
              </DropdownItem>
            </DropdownContent>
          </DropdownMenu>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <Price product={product} />
          {product.isActive === false ? <Badge>Hidden</Badge> : <StatusPill status={stockStatus(product.stock)} />}
        </div>
      </div>
    </Card>
  );
}

const Products = () => {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [state, setState] = useState({ loading: true, error: null });
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || "grid");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const stock = params.get("stock") || "";
  const formOpen = params.get("new") === "1" || !!editing;

  const load = useCallback(async () => {
    setState((s) => ({ ...s, error: null }));
    try {
      const response = await productService.getProducts({ limit: 1000 });
      setProducts(response.data || []);
      setState({ loading: false, error: null });
    } catch (err) {
      setState({ loading: false, error: err.message || "Please try again." });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (category && p.category !== category) return false;
      if (stock === "in" && stockStatus(p.stock) !== "in stock") return false;
      if (stock === "low" && stockStatus(p.stock) !== "low stock") return false;
      if (stock === "out" && stockStatus(p.stock) !== "out of stock") return false;
      return !q || `${p.name} ${p.sku || ""} ${p.description || ""}`.toLowerCase().includes(q);
    });
  }, [products, query, category, stock]);

  const changeView = (next) => {
    setView(next);
    localStorage.setItem(VIEW_KEY, next);
  };

  const setStock = (value) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      value ? next.set("stock", value) : next.delete("stock");
      return next;
    });

  const closeForm = () => {
    setEditing(null);
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("new");
      return next;
    });
  };

  const save = async (data) => {
    if (editing) {
      const response = await productService.updateProduct(editing._id, data);
      setProducts((list) => list.map((p) => (p._id === editing._id ? response.data : p)));
      toast.success("Product updated");
    } else {
      const response = await productService.createProduct(data);
      setProducts((list) => [response.data, ...list]);
      toast.success(`${response.data.name} added`);
    }
  };

  const remove = async () => {
    try {
      await productService.deleteProduct(deleting._id);
      setProducts((list) => list.filter((p) => p._id !== deleting._id));
      toast.success("Product deleted");
    } catch (err) {
      toast.error(err.message || "Couldn't delete the product");
    } finally {
      setDeleting(null);
    }
  };

  const filtersActive = query || category || stock;
  const emptyState = (
    <EmptyState
      icon={filtersActive ? Search : Package}
      title={filtersActive ? "No products match" : "No products yet"}
      description={filtersActive ? "Try another search or filter." : "Add products to send them in chat and add them to orders."}
      action={
        !filtersActive && (
          <Button size="sm" icon={Plus} onClick={() => setParams({ new: "1" })}>
            Add product
          </Button>
        )
      }
    />
  );

  const columns = [
    {
      key: "name",
      header: "Product",
      sortable: true,
      cell: (p) => (
        <span className="flex items-center gap-3">
          <Thumb product={p} className="h-10 w-10 shrink-0 rounded-md border border-line" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{p.name}</span>
            {p.sku && <span className="block truncate font-mono text-xs text-fg-muted">{p.sku}</span>}
          </span>
        </span>
      ),
    },
    { key: "category", header: "Category", sortable: true, hideBelow: "md", cell: (p) => <span className="text-fg-muted">{p.category || "—"}</span> },
    { key: "stock", header: "Stock", sortable: true, cell: (p) => (p.isActive === false ? <Badge>Hidden</Badge> : <StatusPill status={stockStatus(p.stock)} label={`${p.stock} · ${stockStatus(p.stock)}`} />) },
    { key: "price", header: "Price", align: "right", sortable: true, cell: (p) => <Price product={p} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        description="Your catalog: send products in chat and add them to orders."
        actions={
          <Button icon={Plus} onClick={() => setParams({ new: "1" })}>
            Add product
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or SKU"
            aria-label="Search products"
            className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-fg outline-none focus:border-accent focus:ring-3 focus:ring-accent/15"
          />
        </div>
        <div className="flex gap-2">
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category" className={cn(filterClass, "flex-1 sm:flex-none")}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={stock} onChange={(e) => setStock(e.target.value)} aria-label="Filter by stock" className={cn(filterClass, "flex-1 sm:flex-none")}>
            {STOCK_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex rounded-lg border border-line bg-surface p-0.5 sm:ml-auto" role="group" aria-label="View">
          {[
            { value: "grid", icon: LayoutGrid, label: "Grid view" },
            { value: "table", icon: List, label: "Table view" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => changeView(option.value)}
              aria-pressed={view === option.value}
              aria-label={option.label}
              className={cn("rounded-md p-1.5 transition-colors", view === option.value ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg")}
            >
              <option.icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {view === "table" ? (
        <DataTable
          columns={columns}
          rows={visible}
          loading={state.loading}
          error={state.error}
          onRetry={load}
          onRowClick={setEditing}
          rowActions={(p) => [
            { label: "Edit", icon: Pencil, onSelect: () => setEditing(p) },
            { label: "Delete", icon: Trash2, danger: true, onSelect: () => setDeleting(p) },
          ]}
          empty={{ icon: Package, title: "No products yet", description: "Add products to send them in chat and add them to orders." }}
          pageSize={20}
        />
      ) : state.loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
          ))}
        </div>
      ) : state.error ? (
        <Card>
          <ErrorState title="Couldn't load products" description={state.error} onRetry={load} />
        </Card>
      ) : visible.length === 0 ? (
        <Card>{emptyState}</Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((product) => (
            <ProductCard key={product._id} product={product} onEdit={setEditing} onDelete={setDeleting} />
          ))}
        </div>
      )}

      <ProductFormModal open={formOpen} onOpenChange={(open) => !open && closeForm()} product={editing} categories={categories} onSave={save} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="It will be removed from your catalog. Existing orders keep their line items."
        confirmLabel="Delete product"
        onConfirm={remove}
      />
    </div>
  );
};

export default Products;
