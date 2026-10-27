import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Package, ShoppingCart, Users } from "lucide-react";
import adminService from "../../services/admin.service";
import { assetUrl } from "../../config/api.config";
import {
  Avatar,
  Badge,
  ChannelBadge,
  DataTable,
  DetailRow,
  Drawer,
  PageHeader,
  SectionLabel,
  StatusPill,
} from "../../components/ui";
import { formatCurrency, formatDate, formatDateTime, formatRelative } from "../../utils/format";

const filterClass = "h-8 rounded-lg border border-line bg-surface px-2 text-caption text-fg outline-none focus:border-accent";

export const shopName = (shop) => shop?.businessInfo?.businessName || shop?.name || "Deleted shop";

/**
 * Load one platform-wide list, scoped by the ?shop= filter in the URL.
 * Returns rows, load state and the shop filter control.
 */
export function useAdminList(kind) {
  const [params, setParams] = useSearchParams();
  const shop = params.get("shop") || "";
  const [rows, setRows] = useState([]);
  const [state, setState] = useState({ loading: true, error: null });
  const [shops, setShops] = useState([]);

  const load = useCallback(async () => {
    setState({ loading: true, error: null });
    try {
      const response = await adminService.listAll(kind, { shop, limit: 2000 });
      setRows(response.data || []);
      setState({ loading: false, error: null });
    } catch (err) {
      setState({ loading: false, error: err.message || "Please try again." });
    }
  }, [kind, shop]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    adminService
      .getAllUsers({ limit: 1000 })
      .then((res) => setShops(res.data || []))
      .catch(() => setShops([]));
  }, []);

  const setShop = (value) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      value ? next.set("shop", value) : next.delete("shop");
      return next;
    });

  const shopFilter = (
    <select value={shop} onChange={(e) => setShop(e.target.value)} aria-label="Filter by shop" className={filterClass}>
      <option value="">All shops</option>
      {shops.map((s) => (
        <option key={s._id} value={s._id}>
          {shopName(s)}
        </option>
      ))}
    </select>
  );

  return { rows, ...state, load, shopFilter, shop };
}

export const ShopCell = ({ shop }) => (
  <span className="min-w-0">
    <span className="block truncate text-fg">{shopName(shop)}</span>
    <span className="block truncate text-caption text-fg-muted">{shop?.email}</span>
  </span>
);

const ORDER_STATUSES = ["all", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

export function AdminOrders() {
  const list = useAdminList("orders");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(null);
  const rows = useMemo(() => (status === "all" ? list.rows : list.rows.filter((o) => o.status === status)), [list.rows, status]);
  const revenue = rows.filter((o) => o.paymentStatus === "paid" && o.status !== "cancelled").reduce((sum, o) => sum + o.total, 0);

  const columns = [
    { key: "orderNumber", header: "Order", sortable: true, cell: (o) => <span className="whitespace-nowrap font-mono text-caption">{o.orderNumber}</span> },
    { key: "shop", header: "Shop", sortable: true, sortValue: (o) => shopName(o.userId), cell: (o) => <ShopCell shop={o.userId} /> },
    {
      key: "customer",
      header: "Customer",
      hideBelow: "md",
      sortable: true,
      sortValue: (o) => o.customerId?.name,
      cell: (o) => (
        <span className="flex items-center gap-2">
          <Avatar name={o.customerId?.name} size="xs" platform={o.platform} />
          <span className="truncate">{o.customerId?.name || "—"}</span>
        </span>
      ),
    },
    { key: "createdAt", header: "Date", sortable: true, hideBelow: "lg", sortValue: (o) => new Date(o.createdAt), cell: (o) => <span className="text-fg-muted">{formatDate(o.createdAt)}</span> },
    { key: "status", header: "Status", cell: (o) => <StatusPill status={o.status} /> },
    { key: "paymentStatus", header: "Payment", hideBelow: "sm", cell: (o) => <StatusPill status={o.paymentStatus === "pending" ? "unpaid" : o.paymentStatus} label={o.paymentStatus === "pending" ? "Unpaid" : undefined} /> },
    { key: "total", header: "Total", align: "right", sortable: true, cell: (o) => <span className="font-medium">{formatCurrency(o.total)}</span> },
  ];

  return (
    <div>
      <PageHeader title="Orders" description={`Every order from every shop · ${rows.length} orders · ${formatCurrency(revenue)} paid`} />
      <DataTable
        columns={columns}
        rows={rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.load}
        searchable
        searchPlaceholder="Search order #, shop or customer"
        searchText={(o) => `${o.orderNumber} ${shopName(o.userId)} ${o.userId?.email || ""} ${o.customerId?.name || ""} ${o.customerId?.phone || ""}`}
        defaultSort={{ key: "createdAt", dir: "desc" }}
        toolbar={
          <>
            {list.shopFilter}
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className={filterClass}>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All statuses" : s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </>
        }
        onRowClick={setOpen}
        empty={{ icon: ShoppingCart, title: "No orders yet", description: "Orders from every shop appear here." }}
        pageSize={20}
      />
      <Drawer open={!!open} onOpenChange={(v) => !v && setOpen(null)} title={<span className="font-mono">{open?.orderNumber}</span>} description={open && `${shopName(open.userId)} · ${formatDateTime(open.createdAt)}`}>
        {open && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-2">
              <StatusPill status={open.status} />
              <StatusPill status={open.paymentStatus === "pending" ? "unpaid" : open.paymentStatus} />
              <ChannelBadge platform={open.platform} />
            </div>
            <section>
              <SectionLabel className="mb-2">Items</SectionLabel>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {(open.items || []).map((item, i) => (
                  <li key={i} className="flex justify-between gap-3 px-3 py-2.5 text-sm">
                    <span>
                      {item.name} <span className="text-fg-muted">× {item.quantity}</span>
                    </span>
                    <span className="tabular-nums">{formatCurrency(item.total ?? item.price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3">
                <DetailRow label="Total">
                  <span className="font-semibold">{formatCurrency(open.total)}</span>
                </DetailRow>
                <DetailRow label="Payment method">{(open.paymentMethod || "cod").toUpperCase()}</DetailRow>
              </dl>
            </section>
            <section>
              <SectionLabel className="mb-2">Customer</SectionLabel>
              <dl>
                <DetailRow label="Name">{open.customerId?.name || "—"}</DetailRow>
                <DetailRow label="Phone">{open.customerId?.phone || "—"}</DetailRow>
              </dl>
            </section>
            <section>
              <SectionLabel className="mb-2">Shop</SectionLabel>
              <dl>
                <DetailRow label="Shop">{shopName(open.userId)}</DetailRow>
                <DetailRow label="Owner">{open.userId?.name}</DetailRow>
                <DetailRow label="Email">{open.userId?.email}</DetailRow>
              </dl>
            </section>
          </div>
        )}
      </Drawer>
    </div>
  );
}

export function AdminCustomers() {
  const list = useAdminList("customers");

  const columns = [
    {
      key: "name",
      header: "Customer",
      sortable: true,
      cell: (c) => (
        <span className="flex items-center gap-3">
          <Avatar name={c.name} size="sm" platform={c.platform} />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate font-medium">{c.name}</span>
              {c.isBlocked && <Badge tone="danger">Blocked</Badge>}
            </span>
            <span className="block truncate text-caption text-fg-muted">{c.phone || c.email || "—"}</span>
          </span>
        </span>
      ),
    },
    { key: "shop", header: "Shop", sortable: true, sortValue: (c) => shopName(c.userId), cell: (c) => <ShopCell shop={c.userId} /> },
    { key: "platform", header: "Channel", hideBelow: "md", cell: (c) => <ChannelBadge platform={c.platform} /> },
    { key: "totalOrders", header: "Orders", align: "right", sortable: true, hideBelow: "sm", cell: (c) => c.totalOrders || 0 },
    { key: "totalSpent", header: "Spent", align: "right", sortable: true, cell: (c) => formatCurrency(c.totalSpent) },
    {
      key: "lastMessageDate",
      header: "Last message",
      sortable: true,
      hideBelow: "lg",
      sortValue: (c) => (c.lastMessageDate ? new Date(c.lastMessageDate) : null),
      cell: (c) => <span className="text-fg-muted">{c.lastMessageDate ? formatRelative(c.lastMessageDate) : "—"}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Customers" description={`Every customer of every shop · ${list.rows.length} customers`} />
      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.load}
        searchable
        searchPlaceholder="Search customer, phone or shop"
        searchText={(c) => `${c.name} ${c.phone || ""} ${c.email || ""} ${shopName(c.userId)}`}
        toolbar={list.shopFilter}
        empty={{ icon: Users, title: "No customers yet", description: "Customers from every shop appear here." }}
        pageSize={20}
      />
    </div>
  );
}

const stockLabel = (stock = 0) => (stock <= 0 ? "out of stock" : stock <= 5 ? "low stock" : "in stock");

export function AdminProducts() {
  const list = useAdminList("products");

  const columns = [
    {
      key: "name",
      header: "Product",
      sortable: true,
      cell: (p) => (
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface-2">
            {p.images?.[0] ? <img src={assetUrl(p.images[0])} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Package className="h-4 w-4 text-fg-muted" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{p.name}</span>
            <span className="block truncate text-caption text-fg-muted">{p.category || "Uncategorised"}</span>
          </span>
        </span>
      ),
    },
    { key: "shop", header: "Shop", sortable: true, sortValue: (p) => shopName(p.userId), cell: (p) => <ShopCell shop={p.userId} /> },
    { key: "stock", header: "Stock", sortable: true, hideBelow: "sm", cell: (p) => (p.isActive === false ? <Badge>Hidden</Badge> : <StatusPill status={stockLabel(p.stock)} label={`${p.stock} · ${stockLabel(p.stock)}`} />) },
    { key: "price", header: "Price", align: "right", sortable: true, cell: (p) => <span className="font-medium">{formatCurrency(p.price)}</span> },
  ];

  return (
    <div>
      <PageHeader title="Products" description={`Every product in every shop's catalog · ${list.rows.length} products`} />
      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.load}
        searchable
        searchPlaceholder="Search product, SKU or shop"
        searchText={(p) => `${p.name} ${p.sku || ""} ${p.category || ""} ${shopName(p.userId)}`}
        toolbar={list.shopFilter}
        empty={{ icon: Package, title: "No products yet", description: "Products from every shop appear here." }}
        pageSize={20}
      />
    </div>
  );
}
