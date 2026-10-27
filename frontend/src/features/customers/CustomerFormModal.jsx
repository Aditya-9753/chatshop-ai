import React, { useEffect, useState } from "react";
import { Alert, Button, Input, Modal, Select, Textarea } from "../../components/ui";

const EMPTY = { name: "", phone: "", email: "", platform: "whatsapp", notes: "" };

const PLATFORMS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
];

// Add or edit a customer. The channel can only be chosen when adding.
export default function CustomerFormModal({ open, onOpenChange, customer, onSave }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const editing = !!customer;

  useEffect(() => {
    if (!open) return;
    setForm(customer ? { ...EMPTY, ...customer, notes: customer.notes || "" } : EMPTY);
    setErrors({});
    setError("");
  }, [open, customer]);

  const set = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    setErrors({ ...errors, [field]: undefined });
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "Enter a name";
    if (form.platform === "whatsapp" && !form.phone.trim()) next.phone = "WhatsApp customers need a phone number";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        platform: form.platform,
        notes: form.notes.trim(),
      });
      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Couldn't save the customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit customer" : "Add customer"}
      description={editing ? undefined : "Customers who message you are added automatically. Add others here."}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="customer-form" loading={saving}>
            {editing ? "Save changes" : "Add customer"}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input label="Name" required value={form.name} onChange={set("name")} error={errors.name} autoFocus />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Phone" type="tel" value={form.phone} onChange={set("phone")} error={errors.phone} placeholder="+91 98765 43210" />
          <Select label="Channel" value={form.platform} onChange={set("platform")} options={PLATFORMS} disabled={editing} />
        </div>
        <Input label="Email" type="email" value={form.email} onChange={set("email")} error={errors.email} hint="Optional" />
        <Textarea label="Notes" rows={2} value={form.notes} onChange={set("notes")} hint="Optional" />
        {error && <Alert tone="danger">{error}</Alert>}
      </form>
    </Modal>
  );
}
