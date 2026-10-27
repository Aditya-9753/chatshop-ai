import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Eye, Megaphone, Trash2, UserPlus, Users } from "lucide-react";
import adminService from "../../services/admin.service";
import { useToast } from "../../components/Toast";
import {
  Avatar,
  Button,
  ChannelBadge,
  ConfirmDialog,
  DataTable,
  DetailRow,
  Drawer,
  Input,
  PageHeader,
  SectionLabel,
  Select,
  Skeleton,
  StatusPill,
} from "../../components/ui";
import { formatCurrency, formatDate, formatNumber } from "../../utils/format";
import { AddShopModal, BroadcastModal } from "./AdminTools";

const PLAN_OPTIONS = [
  { value: "", label: "No plan" },
  { value: "starter", label: "Starter" },
  { value: "business", label: "Business" },
  { value: "premium", label: "Premium" },
  { value: "one-time", label: "One-time" },
];
const STATUS_OPTIONS = ["active", "inactive", "cancelled", "expired"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));
const filterClass = "h-8 rounded-lg border border-line bg-surface px-2 text-caption text-fg outline-none focus:border-accent";

function exportCsv(users) {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = users.map((u) => [u.name, u.email, u.phone, u.subscription?.plan || "none", u.subscription?.status, formatDate(u.createdAt)].map(cell).join(","));
  const blob = new Blob([[["Name", "Email", "Phone", "Plan", "Status", "Joined"].map(cell).join(","), ...rows].join("\n")], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function UserDrawer({ userId, onClose, onChanged, onDelete, onMessage }) {
  const toast = useToast();
  const [, setParams] = useSearchParams();
  const openSection = (section) => setParams({ section, shop: userId });
  const [detail, setDetail] = useState(null);
  const [subscription, setSubscription] = useState({ plan: "", status: "inactive", endDate: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setDetail(null);
    adminService
      .getUser(userId)
      .then((res) => {
        setDetail(res.data);
        const s = res.data.user.subscription || {};
        setSubscription({ plan: s.plan || "", status: s.status || "inactive", endDate: s.endDate ? s.endDate.slice(0, 10) : "" });
      })
      .catch((err) => {
        toast.error(err.message || "Couldn't load the user");
        onClose();
      });
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true);
    try {
      const response = await adminService.updateUser(userId, {
        subscription: { plan: subscription.plan || null, status: subscription.status, endDate: subscription.endDate || undefined },
      });
      onChanged(response.data);
      toast.success("Subscription updated");
    } catch (err) {
      toast.error(err.message || "Couldn't update the user");
    } finally {
      setSaving(false);
    }
  };

  const user = detail?.user;
  return (
    <Drawer
      open={!!userId}
      onOpenChange={(open) => !open && onClose()}
      title={user?.name || "User"}
      description={user ? `Joined ${formatDate(user.createdAt)}` : undefined}
      footer={
        user && (
          <>
            <Button variant="danger-ghost" icon={Trash2} className="mr-auto" onClick={() => onDelete(user)}>
              Delete user
            </Button>
            <Button variant="secondary" icon={Megaphone} onClick={() => onMessage(user)}>
              Send message
            </Button>
            <Button onClick={save} loading={saving}>
              Save subscription
            </Button>
          </>
        )
      }
    >
      {!detail ? (
        <div className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{user.email}</p>
              <p className="text-caption text-fg-muted">{user.phone}</p>
              {user.businessInfo?.businessName && <p className="text-caption text-fg-muted">{user.businessInfo.businessName}</p>}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ["Customers", formatNumber(detail.stats.customers)],
              ["Orders", formatNumber(detail.stats.orders)],
              ["Messages", formatNumber(detail.stats.messages)],
              ["Products", formatNumber(detail.stats.products)],
              ["Revenue", formatCurrency(detail.stats.revenue)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-line p-2.5">
                <dt className="text-xs text-fg-muted">{label}</dt>
                <dd className="text-sm font-semibold tabular-nums text-fg">{value}</dd>
              </div>
            ))}
          </dl>
          <section>
            <SectionLabel className="mb-2">See this shop's data</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["orders", "Orders"],
                ["customers", "Customers"],
                ["products", "Products"],
                ["messages", "Messages"],
              ].map(([section, label]) => (
                <Button key={section} variant="secondary" size="sm" onClick={() => openSection(section)}>
                  View {label.toLowerCase()}
                </Button>
              ))}
            </div>
          </section>
          <section>
            <SectionLabel className="mb-2">Channels</SectionLabel>
            <dl className="divide-y divide-line/60">
              {["whatsapp", "instagram", "facebook"].map((p) => (
                <DetailRow key={p} label={<ChannelBadge platform={p} />}>
                  <StatusPill status={user[`${p}Config`]?.isConnected ? "active" : "inactive"} label={user[`${p}Config`]?.isConnected ? "Connected" : "Not connected"} />
                </DetailRow>
              ))}
            </dl>
          </section>
          <section className="flex flex-col gap-3">
            <SectionLabel>Subscription</SectionLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select label="Plan" value={subscription.plan} options={PLAN_OPTIONS} onChange={(e) => setSubscription({ ...subscription, plan: e.target.value })} />
              <Select label="Status" value={subscription.status} options={STATUS_OPTIONS} onChange={(e) => setSubscription({ ...subscription, status: e.target.value })} />
              <Input label="Ends on" type="date" value={subscription.endDate} onChange={(e) => setSubscription({ ...subscription, endDate: e.target.value })} />
            </div>
          </section>
        </div>
      )}
    </Drawer>
  );
}

export default function AdminUsers() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [state, setState] = useState({ loading: true, error: null });
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [adding, setAdding] = useState(false);
  const [messageTo, setMessageTo] = useState(null); // [] = every shop

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await adminService.getAllUsers({ limit: 1000, plan, status });
      setUsers(response.data || []);
      setState({ loading: false, error: null });
    } catch (err) {
      setState({ loading: false, error: err.message || "Please try again." });
    }
  }, [plan, status]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async () => {
    try {
      await adminService.deleteUser(deleting._id);
      setUsers((list) => list.filter((u) => u._id !== deleting._id));
      setOpenId(null);
      toast.success(`${deleting.name} and all their data were deleted`);
    } catch (err) {
      toast.error(err.message || "Couldn't delete the user");
    } finally {
      setDeleting(null);
    }
  };

  const columns = [
    {
      key: "name",
      header: "User",
      sortable: true,
      cell: (u) => (
        <span className="flex items-center gap-3">
          <Avatar name={u.name} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{u.name}</span>
            <span className="block truncate text-caption text-fg-muted">{u.email}</span>
          </span>
        </span>
      ),
    },
    { key: "business", header: "Business", hideBelow: "xl", cell: (u) => <span className="text-fg-muted">{u.businessInfo?.businessName || "—"}</span> },
    { key: "plan", header: "Plan", sortable: true, sortValue: (u) => u.subscription?.plan, cell: (u) => <span className="capitalize">{u.subscription?.plan || "—"}</span> },
    { key: "status", header: "Status", cell: (u) => <StatusPill status={u.subscription?.status || "inactive"} /> },
    {
      key: "channels",
      header: "Channels",
      hideBelow: "lg",
      cell: (u) => (
        <span className="flex gap-1.5">
          {["whatsapp", "instagram", "facebook"].filter((p) => u[`${p}Config`]?.isConnected).map((p) => <ChannelBadge key={p} platform={p} compact />)}
          {!["whatsapp", "instagram", "facebook"].some((p) => u[`${p}Config`]?.isConnected) && <span className="text-fg-muted">—</span>}
        </span>
      ),
    },
    { key: "customers", header: "Customers", align: "right", sortable: true, hideBelow: "md", sortValue: (u) => u.activity?.customers || 0, cell: (u) => formatNumber(u.activity?.customers || 0) },
    { key: "orders", header: "Orders", align: "right", sortable: true, hideBelow: "md", sortValue: (u) => u.activity?.orders || 0, cell: (u) => formatNumber(u.activity?.orders || 0) },
    { key: "revenue", header: "Revenue", align: "right", sortable: true, sortValue: (u) => u.activity?.revenue || 0, cell: (u) => <span className="font-medium">{formatCurrency(u.activity?.revenue || 0)}</span> },
    { key: "createdAt", header: "Joined", sortable: true, hideBelow: "sm", sortValue: (u) => new Date(u.createdAt), cell: (u) => <span className="text-fg-muted">{formatDate(u.createdAt)}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Shops"
        description="Every shop on the platform, with its real customers, orders and revenue."
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={() => exportCsv(users)} disabled={!users.length}>
              Export CSV
            </Button>
            <Button variant="secondary" icon={Megaphone} onClick={() => setMessageTo([])}>
              Broadcast
            </Button>
            <Button icon={UserPlus} onClick={() => setAdding(true)}>
              Add shop
            </Button>
          </>
        }
      />
      <DataTable
        columns={columns}
        rows={users}
        loading={state.loading}
        error={state.error}
        onRetry={load}
        searchable
        searchPlaceholder="Search name, email or phone"
        searchText={(u) => `${u.name} ${u.email} ${u.phone || ""} ${u.businessInfo?.businessName || ""}`}
        defaultSort={{ key: "createdAt", dir: "desc" }}
        toolbar={
          <>
            <select value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Filter by plan" className={filterClass}>
              <option value="all">All plans</option>
              {PLAN_OPTIONS.slice(1).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
              <option value="free">No plan</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className={filterClass}>
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </>
        }
        onRowClick={(u) => setOpenId(u._id)}
        rowActions={(u) => [
          { label: "View details", icon: Eye, onSelect: () => setOpenId(u._id) },
          { label: "Send message", icon: Megaphone, onSelect: () => setMessageTo([u]) },
          { label: "Delete", icon: Trash2, danger: true, onSelect: () => setDeleting(u) },
        ]}
        empty={{ icon: Users, title: "No users found", description: "Users appear here as shops sign up." }}
        pageSize={15}
      />
      <UserDrawer
        userId={openId}
        onClose={() => setOpenId(null)}
        onChanged={(user) => setUsers((list) => list.map((u) => (u._id === user._id ? { ...u, ...user } : u)))}
        onDelete={setDeleting}
        onMessage={(u) => setMessageTo([u])}
      />
      <AddShopModal open={adding} onOpenChange={setAdding} onCreated={load} />
      <BroadcastModal open={!!messageTo} onOpenChange={(open) => !open && setMessageTo(null)} recipients={messageTo || []} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="This permanently deletes the account and all of its customers, orders, products and messages."
        confirmLabel="Delete user and data"
        onConfirm={remove}
      />
    </div>
  );
}
