import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, Download, Eye, IndianRupee, PackageCheck, Plus, Printer, RefreshCw, ShoppingCart, Trash2, Truck } from "lucide-react";
import orderService from "../services/order.service";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { Avatar, Button, ChannelBadge, ConfirmDialog, DataTable, PageHeader, StatCard, StatusPill, Tabs } from "../components/ui";
import OrderDrawer from "../features/orders/OrderDrawer";
import OrderForm from "../features/orders/OrderForm";
import { exportOrdersCsv, printInvoice } from "../features/orders/invoice";
import { formatCurrency, formatDate } from "../utils/format";

// Tabs filter by order status, except "Paid" which filters by payment
const TABS = [
  { value: "all", label: "All", match: () => true },
  { value: "pending", label: "Pending", match: (o) => o.status === "pending" },
  { value: "paid", label: "Paid", match: (o) => o.paymentStatus === "paid" },
  { value: "shipped", label: "Shipped", match: (o) => o.status === "shipped" },
  { value: "delivered", label: "Delivered", match: (o) => o.status === "delivered" },
  { value: "cancelled", label: "Cancelled", match: (o) => o.status === "cancelled" },
];

const Orders = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [state, setState] = useState({ loading: true, error: null });
  const [selected, setSelected] = useState([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const tab = TABS.some((t) => t.value === params.get("status")) ? params.get("status") : "all";
  const openId = params.get("id");
  const creating = params.get("new") === "1";
  const openOrder = orders.find((o) => o._id === openId) || null;

  const setParam = (key, value) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      value ? next.set(key, value) : next.delete(key);
      if (key !== "customer" && !value) next.delete("customer");
      return next;
    });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, error: null }));
    try {
      const response = await orderService.getOrders({ limit: 1000 });
      setOrders(response.data || []);
      setState({ loading: false, error: null });
    } catch (err) {
      setState({ loading: false, error: err.message || "Please try again." });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const [payment, setPayment] = useState("all");
  const visible = useMemo(
    () => orders.filter(TABS.find((t) => t.value === tab).match).filter((o) => payment === "all" || o.paymentStatus === payment),
    [orders, tab, payment]
  );
  const summary = useMemo(
    () => ({
      total: orders.length,
      pending: orders.filter((o) => o.status === "pending").length,
      shipped: orders.filter((o) => o.status === "shipped").length,
      delivered: orders.filter((o) => o.status === "delivered").length,
      revenue: orders.filter((o) => o.paymentStatus === "paid" && o.status !== "cancelled").reduce((sum, o) => sum + o.total, 0),
    }),
    [orders]
  );
  const tabs = TABS.map((t) => ({ value: t.value, label: t.label, count: orders.filter(t.match).length }));

  const replace = (order) => setOrders((list) => list.map((o) => (o._id === order._id ? order : o)));

  const update = async (order, changes) => {
    try {
      const response = await orderService.updateOrderStatus(order._id, changes);
      replace(response.data);
      toast.success(`Order ${changes.status ? `marked ${changes.status}` : `payment ${changes.paymentStatus}`}`);
    } catch (err) {
      toast.error(err.message || "Couldn't update the order");
    }
  };

  const bulkUpdate = async (ids, changes) => {
    const results = await Promise.allSettled(ids.map((id) => orderService.updateOrderStatus(id, changes)));
    results.forEach((r) => r.status === "fulfilled" && replace(r.value.data));
    const failed = results.filter((r) => r.status === "rejected").length;
    failed ? toast.error(`${failed} of ${ids.length} orders couldn't be updated`) : toast.success(`${ids.length} orders updated`);
    setSelected([]);
  };

  const remove = async (order) => {
    try {
      await orderService.deleteOrder(order._id);
      setOrders((list) => list.filter((o) => o._id !== order._id));
      setParam("id", null);
      toast.success("Order deleted");
    } catch (err) {
      toast.error(err.message || "Couldn't delete the order");
    }
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    await Promise.allSettled(ids.map((id) => orderService.deleteOrder(id)));
    setOrders((list) => list.filter((o) => !ids.includes(o._id)));
    setSelected([]);
    setConfirmBulkDelete(false);
    toast.success(`${ids.length} orders deleted`);
  };

  const create = async (data) => {
    const response = await orderService.createOrder(data);
    setOrders((list) => [response.data, ...list]);
    toast.success(`Order ${response.data.orderNumber} created`);
  };

  const columns = [
    {
      key: "orderNumber",
      header: "Order",
      sortable: true,
      cell: (o) => <span className="whitespace-nowrap font-mono text-caption text-fg">{o.orderNumber}</span>,
    },
    {
      key: "customer",
      header: "Customer",
      sortable: true,
      sortValue: (o) => o.customerId?.name,
      cell: (o) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={o.customerId?.name} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{o.customerId?.name || "Unknown"}</span>
            <span className="block truncate text-caption text-fg-muted">{o.customerId?.phone}</span>
          </span>
        </span>
      ),
    },
    { key: "platform", header: "Channel", hideBelow: "lg", cell: (o) => <ChannelBadge platform={o.platform} /> },
    {
      key: "createdAt",
      header: "Date",
      sortable: true,
      hideBelow: "md",
      sortValue: (o) => new Date(o.createdAt),
      cell: (o) => <span className="text-fg-muted">{formatDate(o.createdAt)}</span>,
    },
    { key: "status", header: "Status", sortable: true, cell: (o) => <StatusPill status={o.status} /> },
    { key: "paymentStatus", header: "Payment", hideBelow: "sm", cell: (o) => <StatusPill status={o.paymentStatus === "pending" ? "unpaid" : o.paymentStatus} label={o.paymentStatus === "pending" ? "Unpaid" : undefined} /> },
    { key: "total", header: "Total", align: "right", sortable: true, cell: (o) => <span className="font-medium">{formatCurrency(o.total)}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Every order taken over chat, from first message to delivery."
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={() => exportOrdersCsv(visible)} disabled={!visible.length}>
              Export CSV
            </Button>
            <Button icon={Plus} onClick={() => setParam("new", "1")}>
              New order
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total orders" icon={ShoppingCart} loading={state.loading} value={summary.total} />
        <StatCard label="Pending" icon={Clock} loading={state.loading} value={summary.pending} />
        <StatCard label="Shipped" icon={Truck} loading={state.loading} value={summary.shipped} />
        <StatCard label="Delivered" icon={PackageCheck} loading={state.loading} value={summary.delivered} />
        <StatCard label="Revenue (paid)" icon={IndianRupee} loading={state.loading} value={formatCurrency(summary.revenue)} className="col-span-2 lg:col-span-1" />
      </div>

      <Tabs tabs={tabs} value={tab} onChange={(value) => setParam("status", value === "all" ? null : value)} label="Order status" className="mb-4" />

      <DataTable
        columns={columns}
        rows={visible}
        loading={state.loading}
        error={state.error}
        onRetry={load}
        searchable
        searchPlaceholder="Search order #, customer or phone"
        toolbar={
          <>
            <select
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
              aria-label="Filter by payment"
              className="h-8 rounded-lg border border-line bg-surface px-2 text-caption text-fg outline-none focus:border-accent"
            >
              <option value="all">All payments</option>
              <option value="paid">Paid</option>
              <option value="pending">Unpaid</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={load} aria-label="Refresh orders">
              Refresh
            </Button>
          </>
        }
        searchText={(o) => `${o.orderNumber} ${o.customerId?.name || ""} ${o.customerId?.phone || ""}`}
        defaultSort={{ key: "createdAt", dir: "desc" }}
        onRowClick={(o) => setParam("id", o._id)}
        selected={selected}
        onSelectedChange={setSelected}
        bulkActions={(ids) => (
          <>
            <Button size="sm" variant="secondary" icon={CheckCircle2} onClick={() => bulkUpdate(ids, { status: "confirmed" })}>
              Confirm
            </Button>
            <Button size="sm" variant="secondary" icon={Truck} onClick={() => bulkUpdate(ids, { status: "shipped" })}>
              Mark shipped
            </Button>
            <Button size="sm" variant="secondary" icon={IndianRupee} onClick={() => bulkUpdate(ids, { paymentStatus: "paid" })}>
              Mark paid
            </Button>
            <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={() => setConfirmBulkDelete(true)}>
              Delete
            </Button>
          </>
        )}
        rowActions={(o) => [
          { label: "View details", icon: Eye, onSelect: () => setParam("id", o._id) },
          { label: "Print invoice", icon: Printer, onSelect: () => printInvoice(o, user) },
          { label: "Delete", icon: Trash2, danger: true, onSelect: () => remove(o) },
        ]}
        empty={{
          icon: ShoppingCart,
          title: tab === "all" ? "No orders yet" : "No orders here",
          description: tab === "all" ? "Create an order when a customer confirms a purchase in chat." : "Orders with this status will show up here.",
          action: tab === "all" && (
            <Button size="sm" icon={Plus} onClick={() => setParam("new", "1")}>
              New order
            </Button>
          ),
        }}
      />

      <OrderDrawer
        order={openOrder}
        open={!!openOrder}
        onOpenChange={(open) => !open && setParam("id", null)}
        onUpdate={update}
        onDelete={remove}
      />
      <OrderForm
        open={creating}
        onOpenChange={(open) => !open && setParam("new", null)}
        initialCustomerId={params.get("customer")}
        onCreate={create}
      />
      <ConfirmDialog
        open={confirmBulkDelete}
        onOpenChange={setConfirmBulkDelete}
        title={`Delete ${selected.length} orders?`}
        description="This can't be undone."
        confirmLabel="Delete orders"
        onConfirm={bulkDelete}
      />
    </div>
  );
};

export default Orders;
