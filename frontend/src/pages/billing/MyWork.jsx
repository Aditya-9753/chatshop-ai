import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Boxes, CalendarClock, IndianRupee, Plus, Receipt, ScrollText, Users, Wallet } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, ErrorState, PageHeader, Skeleton, StatCard } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useBilling } from "../../features/billing/BillingContext";
import { BillingGate, Money, StateBadge, useLoad } from "../../features/billing/components";
import { emiApi, inr } from "../../features/billing/api";

const B = "/dashboard/billing";
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function Row({ to, title, detail, children }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{title}</span>
          <span className="block truncate text-caption text-fg-muted">{detail}</span>
        </span>
        {children}
        <ArrowRight className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
      </Link>
    </li>
  );
}

function ListCard({ title, action, loading, empty, children }) {
  const rows = React.Children.toArray(children);
  return (
    <Card>
      <CardHeader title={title} action={action} />
      <CardBody className="px-3">
        {loading ? <Skeleton className="h-24 w-full" /> : rows.length ? <ul className="flex flex-col">{rows}</ul> : <p className="px-2 py-3 text-caption text-fg-muted">{empty}</p>}
      </CardBody>
    </Card>
  );
}

const open = (to, label = "Open") => (
  <Link className="text-caption text-accent hover:underline" to={to}>
    {label}
  </Link>
);

// Counter work: my sales, my EMI receipts and stock running low
function CounterWork({ d, loading }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="My sales today" icon={Receipt} loading={loading} value={d ? inr(d.sales.gross, { whole: true }) : "—"} deltaNote={d && plural(d.sales.count, "invoice")} />
        <StatCard label="EMI I collected today" icon={Wallet} loading={loading} value={d ? inr(d.collections.amount, { whole: true }) : "—"} deltaNote={d && plural(d.collections.count, "receipt")} />
        <StatCard className="col-span-2 lg:col-span-1" label="Low on stock" icon={Boxes} loading={loading} value={d ? d.lowStock.length : "—"} deltaNote="2 or fewer left" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard title="My recent invoices" action={open(`${B}/invoices`, "All invoices")} loading={loading} empty="No invoices yet. Your sales show here.">
          {d?.sales.recent.map((inv) => (
            <Row key={inv._id} to={`${B}/invoices/${inv._id}`} title={`${inv.invoiceNo} · ${inv.customer?.name || "Customer"}`} detail={inv.date}>
              <Money value={inv.grossTotal} className="text-sm" />
              <StateBadge status={inv.status} className="hidden sm:inline-flex" />
            </Row>
          ))}
        </ListCard>
        <ListCard title="Running low" action={open(`${B}/stock`, "Stock")} loading={loading} empty="Nothing is running low.">
          {d?.lowStock.slice(0, 8).map((p) => (
            <Row key={p._id} to={`${B}/stock`} title={p.name} detail={p.available ? `${p.available} left` : "Out of stock"}>
              <Badge tone={p.available ? "warning" : "danger"}>{p.available}</Badge>
            </Row>
          ))}
        </ListCard>
      </div>
    </section>
  );
}

// EMI work: an agent's assigned customers, or every contract of the store
function AgentWork({ a, loading }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={a?.scope === "store" ? "Active EMI contracts" : "Assigned to me"} icon={Users} loading={loading} value={a ? a.assigned : "—"} deltaNote={a?.scope === "store" ? "in your stores" : "active EMI contracts"} />
        <StatCard label="Due today" icon={CalendarClock} loading={loading} value={a ? a.dueToday.length : "—"} deltaNote="customers to visit" />
        <StatCard label="Overdue" icon={AlertTriangle} loading={loading} value={a ? inr(a.overdueAmount, { whole: true }) : "—"} deltaNote={a && plural(a.overdue.length, "customer")} />
        <StatCard label="I collected today" icon={Wallet} loading={loading} value={a ? inr(a.collectedToday.amount, { whole: true }) : "—"} deltaNote={a && plural(a.collectedToday.count, "receipt")} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard title="Overdue: collect first" action={open(`${B}/emi?view=overdue`)} loading={loading} empty="No overdue customers. Well done.">
          {a?.overdue.slice(0, 10).map((c) => (
            <Row key={c._id} to={`${B}/emi/${c._id}`} title={c.customer?.name || c.contractNo} detail={`${c.contractNo} · ${c.customer?.phone || ""} · ${c.currentDpd} days late`}>
              <Money value={c.dueNow} className="text-sm font-medium text-danger-fg" />
            </Row>
          ))}
        </ListCard>
        <ListCard title="Due today" action={open(`${B}/emi`)} loading={loading} empty="Nothing due today.">
          {a?.dueToday.slice(0, 10).map((c) => (
            <Row key={c._id} to={`${B}/emi/${c._id}`} title={c.customer?.name || c.contractNo} detail={`${c.contractNo} · ${c.customer?.phone || ""}`}>
              <Money value={c.emiAmount} className="text-sm" />
            </Row>
          ))}
        </ListCard>
      </div>
    </section>
  );
}

// Accounts work: settlement, and this month's GST when the role covers it
function AccountsWork({ x, loading }) {
  const gst = loading || x?.gst;
  return (
    <section className="flex flex-col gap-4">
      <div className={`grid grid-cols-2 gap-3 ${gst ? "lg:grid-cols-4" : ""}`}>
        <StatCard label="Waiting to settle" icon={Wallet} loading={loading} value={x ? inr(x.awaitingSettlement.amount, { whole: true }) : "—"} deltaNote={x && plural(x.awaitingSettlement.count, "payment")} />
        <StatCard label="Collected today" icon={IndianRupee} loading={loading} value={x ? inr(x.collectedToday.amount, { whole: true }) : "—"} deltaNote={x && plural(x.collectedToday.count, "payment")} />
        {gst && (
          <>
            <StatCard label="GST collected" icon={Receipt} loading={loading} value={x?.gst ? inr(x.gst.output, { whole: true }) : "—"} deltaNote={x?.gst && `Output GST, ${x.gst.month}`} />
            <StatCard label="Net GST payable" icon={ScrollText} loading={loading} value={x?.gst ? inr(x.gst.netPayable, { whole: true }) : "—"} deltaNote="after input credit" />
          </>
        )}
      </div>
    </section>
  );
}

// Every page this person works in, one tap away
function PageLinks({ items }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Button key={item.key} as={Link} to={item.href} variant="secondary" icon={item.icon}>
          {item.name}
        </Button>
      ))}
    </div>
  );
}

const SECTION_TITLES = { counter: "Counter", agent: "Collections", accounts: "Accounts" };

function Work() {
  const { user } = useAuth();
  const { roles, store, can, items } = useBilling();
  const { data: d, loading, error, reload } = useLoad(() => emiApi.get("/reports/my"), [store?._id]);
  if (error) return <ErrorState description={error.message} onRetry={reload} />;
  // Which work shows comes from the server, which knows each role's work
  const sections = d ? [d.sales && "counter", d.agent && "agent", d.accounts && "accounts"].filter(Boolean) : [];
  const pages = items.filter((item) => !["home", "account"].includes(item.key));

  return (
    <>
      <PageHeader
        title={`Namaste, ${user?.name?.split(" ")[0] || "there"}`}
        description={`${roles.map((r) => r.label).join(", ")} · your work for today`}
        actions={
          can("invoice.create") && (
            <Button as={Link} to={`${B}/sale`} icon={Plus}>
              New sale
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-8">
        {loading && !d && <Skeleton className="h-48 w-full" />}
        {sections.map((key) => (
          <div key={key}>
            {sections.length > 1 && <h2 className="mb-3 text-sm font-semibold text-fg-muted">{SECTION_TITLES[key]}</h2>}
            {key === "counter" && <CounterWork d={d} loading={false} />}
            {key === "agent" && <AgentWork a={d.agent} loading={false} />}
            {key === "accounts" && <AccountsWork x={d.accounts} loading={false} />}
          </div>
        ))}
        {d && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-fg-muted">Your pages</h2>
            <PageLinks items={pages} />
          </div>
        )}
      </div>
    </>
  );
}

export default function MyWork() {
  return (
    <BillingGate>
      <Work />
    </BillingGate>
  );
}
