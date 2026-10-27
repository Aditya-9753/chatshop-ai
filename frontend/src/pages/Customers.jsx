import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Ban, Eye, MessageSquare, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import customerService from "../services/customer.service";
import { useToast } from "../components/Toast";
import { Avatar, Badge, Button, ChannelBadge, DataTable, PageHeader } from "../components/ui";
import CustomerDrawer from "../features/customers/CustomerDrawer";
import CustomerFormModal from "../features/customers/CustomerFormModal";
import { PRESET_TAGS } from "../features/inbox/CustomerPanel";
import { formatCurrency, formatRelative } from "../utils/format";

const CHANNELS = [
  { value: "", label: "All channels" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
];

const filterClass =
  "h-8 rounded-lg border border-line bg-surface px-2 text-caption text-fg outline-none focus:border-accent";

const Customers = () => {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const [state, setState] = useState({ loading: true, error: null });
  const [channel, setChannel] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState(null);

  const openId = params.get("id");
  const formOpen = params.get("new") === "1" || !!editing;
  const openCustomer = customers.find((c) => c._id === openId) || null;

  const setParam = (key, value) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      value ? next.set(key, value) : next.delete(key);
      return next;
    });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, error: null }));
    try {
      const response = await customerService.getCustomers({ limit: 1000 });
      setCustomers(response.data || []);
      setState({ loading: false, error: null });
    } catch (err) {
      setState({ loading: false, error: err.message || "Please try again." });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const allTags = useMemo(() => [...new Set([...PRESET_TAGS, ...customers.flatMap((c) => c.tags || [])])].sort(), [customers]);
  const visible = useMemo(
    () =>
      customers.filter(
        (c) =>
          (!channel || c.platform === channel) &&
          (!tag || (c.tags || []).includes(tag)) &&
          (!status || (status === "blocked" ? c.isBlocked : !c.isBlocked))
      ),
    [customers, channel, tag, status]
  );

  const replace = (customer) => setCustomers((list) => list.map((c) => (c._id === customer._id ? { ...c, ...customer } : c)));

  const save = async (data) => {
    if (editing) {
      const response = await customerService.updateCustomer(editing._id, data);
      replace(response.data);
      toast.success("Customer updated");
    } else {
      const response = await customerService.createCustomer(data);
      setCustomers((list) => [response.data, ...list]);
      toast.success(`${response.data.name} added`);
    }
  };

  const toggleBlock = async (customer) => {
    try {
      const response = await customerService.blockCustomer(customer._id, !customer.isBlocked);
      replace(response.data);
      toast.success(customer.isBlocked ? "Customer unblocked" : "Customer blocked. You won't be able to message them.");
    } catch (err) {
      toast.error(err.message || "Couldn't update the customer");
    }
  };

  const remove = async (customer) => {
    try {
      await customerService.deleteCustomer(customer._id);
      setCustomers((list) => list.filter((c) => c._id !== customer._id));
      setParam("id", null);
      toast.success("Customer deleted");
    } catch (err) {
      toast.error(err.message || "Couldn't delete the customer");
    }
  };

  const closeForm = () => {
    setEditing(null);
    setParam("new", null);
  };

  const columns = [
    {
      key: "name",
      header: "Customer",
      sortable: true,
      cell: (c) => (
        <span className="flex items-center gap-3">
          <Avatar name={c.name} size="sm" />
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
    { key: "platform", header: "Channel", sortable: true, hideBelow: "sm", cell: (c) => <ChannelBadge platform={c.platform} /> },
    {
      key: "tags",
      header: "Tags",
      hideBelow: "lg",
      cell: (c) => (
        <span className="flex flex-wrap gap-1">
          {(c.tags || []).slice(0, 3).map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
          {(c.tags || []).length > 3 && <span className="text-xs text-fg-muted">+{c.tags.length - 3}</span>}
        </span>
      ),
    },
    { key: "totalOrders", header: "Orders", align: "right", sortable: true, hideBelow: "md", cell: (c) => c.totalOrders || 0 },
    { key: "totalSpent", header: "Total spent", align: "right", sortable: true, cell: (c) => formatCurrency(c.totalSpent) },
    {
      key: "lastMessageDate",
      header: "Last message",
      sortable: true,
      hideBelow: "md",
      sortValue: (c) => (c.lastMessageDate ? new Date(c.lastMessageDate) : null),
      cell: (c) => <span className="text-fg-muted">{c.lastMessageDate ? formatRelative(c.lastMessageDate) : "—"}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Everyone who has messaged or bought from you, across every channel."
        actions={
          <Button icon={UserPlus} onClick={() => setParam("new", "1")}>
            Add customer
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={visible}
        loading={state.loading}
        error={state.error}
        onRetry={load}
        searchable
        searchPlaceholder="Search name, phone or email"
        searchText={(c) => `${c.name} ${c.phone || ""} ${c.email || ""}`}
        defaultSort={{ key: "lastMessageDate", dir: "desc" }}
        toolbar={
          <>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Filter by channel" className={filterClass}>
              {CHANNELS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className={filterClass}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
            </select>
            {allTags.length > 0 && (
              <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter by tag" className={filterClass}>
                <option value="">All tags</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </>
        }
        onRowClick={(c) => setParam("id", c._id)}
        rowActions={(c) => [
          { label: "View profile", icon: Eye, onSelect: () => setParam("id", c._id) },
          { label: "Edit", icon: Pencil, onSelect: () => setEditing(c) },
          { label: c.isBlocked ? "Unblock" : "Block", icon: Ban, onSelect: () => toggleBlock(c) },
          { label: "Delete", icon: Trash2, danger: true, onSelect: () => remove(c) },
        ]}
        empty={{
          icon: Users,
          title: channel || tag || status ? "No customers match these filters" : "No customers yet",
          description:
            channel || tag || status
              ? "Try a different channel, tag or status."
              : "Customers appear here automatically when they message you. You can also add them by hand.",
          action: !channel && !tag && !status && (
            <Button as={Link} to="/dashboard/settings?tab=channels" size="sm" variant="secondary" icon={MessageSquare}>
              Connect a channel
            </Button>
          ),
        }}
      />

      <CustomerDrawer
        customer={openCustomer}
        open={!!openCustomer}
        onOpenChange={(open) => !open && setParam("id", null)}
        onChange={replace}
        onEdit={(c) => setEditing(c)}
        onBlock={toggleBlock}
        onDelete={remove}
      />
      <CustomerFormModal open={formOpen} onOpenChange={(open) => !open && closeForm()} customer={editing} onSave={save} />
    </div>
  );
};

export default Customers;
