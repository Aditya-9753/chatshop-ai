import React, { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import api from "../../services/api.service";
import { API_ENDPOINTS, assetUrl } from "../../config/api.config";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { Avatar, Button, Card, CardBody, CardHeader, Input, Select, Textarea } from "../../components/ui";

const BUSINESS_TYPES = ["", "Fashion & apparel", "Electronics", "Beauty & personal care", "Food & grocery", "Home & living", "Services", "Other"].map(
  (value) => ({ value, label: value || "Choose a type…" })
);

function SaveRow({ saving, dirty }) {
  return (
    <div className="flex justify-end border-t border-line px-5 py-3">
      <Button type="submit" loading={saving} disabled={!dirty}>
        Save changes
      </Button>
    </div>
  );
}

export default function ProfileSettings({ profile, onProfileChange }) {
  const { updateUser } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);

  const [me, setMe] = useState({ name: "", email: "", phone: "" });
  const [photo, setPhoto] = useState(null);
  const [business, setBusiness] = useState({ businessName: "", businessType: "", website: "", address: "", gstNumber: "" });
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    setMe({ name: profile.name || "", email: profile.email || "", phone: profile.phone || "" });
    setBusiness({ businessName: "", businessType: "", website: "", address: "", gstNumber: "", ...profile.businessInfo });
  }, [profile]);

  const meDirty = photo || me.name !== profile.name || me.email !== profile.email || me.phone !== (profile.phone || "");
  const businessDirty = Object.entries(business).some(([k, v]) => (profile.businessInfo?.[k] || "") !== (v || ""));

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving("me");
    try {
      const data = new FormData();
      Object.entries(me).forEach(([k, v]) => data.append(k, v.trim()));
      if (photo) data.append("profilePhoto", photo.file);
      const response = await api.put(API_ENDPOINTS.USER.UPDATE_PROFILE, data);
      onProfileChange(response.data);
      updateUser({ name: response.data.name, email: response.data.email, phone: response.data.phone, profilePhoto: response.data.profilePhoto });
      setPhoto(null);
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err.message || "Couldn't save your profile");
    } finally {
      setSaving(null);
    }
  };

  const saveBusiness = async (e) => {
    e.preventDefault();
    setSaving("business");
    try {
      const response = await api.put(API_ENDPOINTS.USER.BUSINESS_INFO, business);
      onProfileChange({ ...profile, businessInfo: response.data });
      updateUser({ businessInfo: response.data });
      toast.success("Business details saved");
    } catch (err) {
      toast.error(err.message || "Couldn't save business details");
    } finally {
      setSaving(null);
    }
  };

  const pickPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Photos must be under 5 MB");
    setPhoto({ file, preview: URL.createObjectURL(file) });
  };

  const setMeField = (field) => (e) => setMe({ ...me, [field]: e.target.value });
  const setBizField = (field) => (e) => setBusiness({ ...business, [field]: e.target.value });

  return (
    <div className="flex flex-col gap-6">
      <Card as="form" onSubmit={saveProfile}>
        <CardHeader title="Your profile" description="How you appear to your team." />
        <CardBody className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <Avatar name={me.name} src={photo?.preview || assetUrl(profile.profilePhoto)} size="xl" />
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
              <Button variant="secondary" size="sm" icon={Camera} onClick={() => fileRef.current?.click()}>
                {profile.profilePhoto || photo ? "Change photo" : "Upload photo"}
              </Button>
              <p className="mt-1.5 text-xs text-fg-muted">Square images work best. Up to 5 MB.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Full name" value={me.name} onChange={setMeField("name")} autoComplete="name" />
            <Input label="Phone" type="tel" value={me.phone} onChange={setMeField("phone")} autoComplete="tel" />
          </div>
          <Input label="Email" type="email" value={me.email} onChange={setMeField("email")} autoComplete="email" hint="Used to log in and for password resets." />
        </CardBody>
        <SaveRow saving={saving === "me"} dirty={meDirty} />
      </Card>

      <Card as="form" onSubmit={saveBusiness}>
        <CardHeader title="Business" description="Shown on invoices and in your workspace name." />
        <CardBody className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Business name" value={business.businessName} onChange={setBizField("businessName")} autoComplete="organization" />
            <Select label="Business type" value={business.businessType || ""} onChange={setBizField("businessType")} options={BUSINESS_TYPES} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Website" type="url" value={business.website} onChange={setBizField("website")} placeholder="https://" />
            <Input label="GSTIN" value={business.gstNumber} onChange={setBizField("gstNumber")} inputClassName="font-mono uppercase" hint="Printed on invoices" />
          </div>
          <Textarea label="Address" rows={2} value={business.address} onChange={setBizField("address")} />
        </CardBody>
        <SaveRow saving={saving === "business"} dirty={businessDirty} />
      </Card>
    </div>
  );
}
