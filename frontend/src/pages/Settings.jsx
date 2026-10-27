import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CreditCard, Lock, MessageSquare, Sparkles, User, Users } from "lucide-react";
import api from "../services/api.service";
import { API_ENDPOINTS } from "../config/api.config";
import { Card, cn, ErrorState, PageHeader, Skeleton } from "../components/ui";
import ProfileSettings from "../features/settings/ProfileSettings";
import ChannelSettings from "../features/settings/ChannelSettings";
import { AiSettings, BillingSettings, SecuritySettings, TeamSettings } from "../features/settings/AccountSettings";

const SECTIONS = [
  { value: "profile", label: "Profile", icon: User, component: ProfileSettings },
  { value: "channels", label: "Channels", icon: MessageSquare, component: ChannelSettings },
  { value: "ai", label: "AI replies", icon: Sparkles, component: AiSettings },
  { value: "billing", label: "Billing", icon: CreditCard, component: BillingSettings },
  { value: "team", label: "Team", icon: Users, component: TeamSettings },
  { value: "security", label: "Security", icon: Lock, component: SecuritySettings },
];

const Settings = () => {
  const [params, setParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  const active = SECTIONS.find((s) => s.value === params.get("tab")) || SECTIONS[0];
  const Section = active.component;

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await api.get(API_ENDPOINTS.USER.PROFILE);
      setProfile(response.data);
    } catch (err) {
      setError(err.message || "Please try again.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Settings" description="Your profile, channels, plan and security." />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-20 lg:w-52 lg:shrink-0">
          <ul className="flex gap-1 overflow-x-auto scrollbar-none lg:flex-col">
            {SECTIONS.map((section) => {
              const selected = section.value === active.value;
              return (
                <li key={section.value}>
                  <button
                    onClick={() => setParams({ tab: section.value })}
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "flex h-8 w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 text-sm transition-colors",
                      selected ? "bg-surface-2 font-medium text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                    )}
                  >
                    <section.icon className={cn("h-4 w-4", selected && "text-accent")} aria-hidden="true" />
                    {section.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 flex-1 lg:max-w-3xl">
          {error ? (
            <Card>
              <ErrorState title="Couldn't load your settings" description={error} onRetry={load} />
            </Card>
          ) : !profile ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          ) : (
            <Section profile={profile} onProfileChange={setProfile} onReload={load} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
