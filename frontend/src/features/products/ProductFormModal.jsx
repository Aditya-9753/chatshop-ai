import React, { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { assetUrl } from "../../config/api.config";
import { Alert, Button, cn, Input, Modal, Switch, Textarea } from "../../components/ui";

const EMPTY = { name: "", description: "", price: "", comparePrice: "", stock: "", category: "", sku: "", isActive: true };
const MAX_IMAGE_MB = 5;

// Drop zone with preview; click or drag an image onto it
function ImageDrop({ preview, onFile, onClear }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const take = (file) => {
    if (file && file.type.startsWith("image/")) onFile(file);
  };

  return (
    <div>
      <span className="mb-1.5 block text-caption font-medium text-fg">Image</span>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed transition-colors",
          dragging ? "border-accent bg-accent-soft" : "border-line-strong bg-surface-2"
        )}
      >
        {preview ? (
          <>
            <img src={preview} alt="Product preview" className="h-full w-full object-cover" />
            <div className="absolute right-2 top-2 flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
                Replace
              </Button>
              <Button size="icon-sm" variant="secondary" icon={X} onClick={onClear} aria-label="Remove image" />
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-center"
          >
            <ImagePlus className="h-6 w-6 text-fg-muted" aria-hidden="true" />
            <span className="text-sm font-medium text-fg">Drop an image or click to upload</span>
            <span className="text-xs text-fg-muted">PNG, JPG or WebP, up to {MAX_IMAGE_MB} MB</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default function ProductFormModal({ open, onOpenChange, product, categories, onSave }) {
  const [form, setForm] = useState(EMPTY);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      product
        ? {
            ...EMPTY,
            ...product,
            price: String(product.price ?? ""),
            comparePrice: product.comparePrice ? String(product.comparePrice) : "",
            stock: String(product.stock ?? ""),
            description: product.description || "",
            category: product.category || "",
            sku: product.sku || "",
          }
        : EMPTY
    );
    setImage(null);
    setPreview(product?.images?.[0] ? assetUrl(product.images[0]) : null);
    setErrors({});
    setError("");
  }, [open, product]);

  useEffect(() => () => preview?.startsWith("blob:") && URL.revokeObjectURL(preview), [preview]);

  const set = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    setErrors({ ...errors, [field]: undefined });
  };

  const pickImage = (file) => {
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setError(`Images must be under ${MAX_IMAGE_MB} MB`);
      return;
    }
    setError("");
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "Enter a product name";
    if (!(Number(form.price) >= 0) || form.price === "") next.price = "Enter a price";
    if (form.comparePrice && Number(form.comparePrice) <= Number(form.price)) next.comparePrice = "Should be higher than the price";
    if (form.stock !== "" && !(Number(form.stock) >= 0)) next.stock = "Stock can't be negative";
    setErrors(next);
    if (Object.keys(next).length) return;

    const data = new FormData();
    data.append("name", form.name.trim());
    data.append("description", form.description.trim());
    data.append("price", form.price);
    if (form.comparePrice) data.append("comparePrice", form.comparePrice);
    data.append("stock", form.stock || "0");
    data.append("category", form.category.trim());
    data.append("sku", form.sku.trim());
    data.append("isActive", String(form.isActive));
    if (image) data.append("image", image);

    setSaving(true);
    try {
      await onSave(data);
      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Couldn't save the product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={product ? "Edit product" : "Add product"}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" loading={saving}>
            {product ? "Save changes" : "Add product"}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} noValidate className="grid grid-cols-1 gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
        <ImageDrop
          preview={preview}
          onFile={pickImage}
          onClear={() => {
            setImage(null);
            setPreview(null);
          }}
        />
        <div className="flex flex-col gap-4">
          <Input label="Name" required value={form.name} onChange={set("name")} error={errors.name} autoFocus />
          <Textarea label="Description" rows={3} value={form.description} onChange={set("description")} hint="Shown when you send this product in chat" />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Price ₹" type="number" min={0} step="0.01" required value={form.price} onChange={set("price")} error={errors.price} />
            <Input label="Compare at ₹" type="number" min={0} step="0.01" value={form.comparePrice} onChange={set("comparePrice")} error={errors.comparePrice} />
            <Input label="Stock" type="number" min={0} value={form.stock} onChange={set("stock")} error={errors.stock} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Category" list="product-categories" value={form.category} onChange={set("category")} />
            <datalist id="product-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <Input label="SKU" value={form.sku} onChange={set("sku")} inputClassName="font-mono" />
          </div>
          <Switch
            label="Available for sale"
            description="Hidden products can't be added to orders or sent in chat."
            checked={form.isActive}
            onCheckedChange={(isActive) => setForm({ ...form, isActive })}
          />
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      </form>
    </Modal>
  );
}
