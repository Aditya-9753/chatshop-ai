import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  cn,
} from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import guardianApi from "../../../services/guardianApi";
import { useRealtime } from "../../../services/realtime";

const SEVERITY_TONES = {
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "neutral",
};

export default function GuardianNotifications() {
  const navigate = useNavigate();
  const toast = useToast();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [markingRead, setMarkingRead] = useState(null);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await guardianApi.getNotifications({ page, limit: 20 });
      const data = res.data || res;
      const list = data.notifications || data.data || (Array.isArray(data) ? data : []);
      const total = data.totalPages || data.pages || 1;
      setNotifications(list);
      setTotalPages(total);
    } catch (err) {
      setError(err.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Real-time new notifications
  useRealtime("guardian:incident:new", (incident) => {
    if (incident.severity === "CRITICAL") {
      const syntheticNotif = {
        _id: `rt-${incident._id}`,
        incidentId: incident._id || incident,
        title: incident.title,
        severity: incident.severity,
        eventType: "incident_created",
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [syntheticNotif, ...prev]);
    }
  });
  useRealtime("guardian:incident:updated", (update) => {
    if (update.status !== "RESOLVED") return;
    const incidentId = String(update.incidentId?._id || update.incidentId || update._id);
    setNotifications((prev) =>
      prev.map((notification) =>
        String(notification.incidentId?._id || notification.incidentId) === incidentId
          ? { ...notification, readAt: notification.readAt || new Date().toISOString() }
          : notification
      )
    );
  });

  async function markRead(id) {
    if (String(id).startsWith("rt-")) {
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      return;
    }
    setMarkingRead(id);
    try {
      await guardianApi.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch {
      toast.error("Failed to mark as read");
    } finally {
      setMarkingRead(null);
    }
  }

  async function goToIncident(notif) {
    if (!notif.readAt) await markRead(notif._id);
    const incId = notif.incidentId?._id || notif.incidentId;
    if (incId) navigate(`/admin/dashboard?section=guardian_incidents&incident=${incId}`);
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Guardian system alerts and notifications"
        icon={Bell}
        action={
          unreadCount > 0 && (
            <Badge tone="danger">{unreadCount} unread</Badge>
          )
        }
      />

      <div className="mt-6 space-y-4">
        {error ? (
          <ErrorState
            title="Failed to load notifications"
            description={error}
            action={<Button onClick={fetchNotifications}>Retry</Button>}
          />
        ) : loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-line bg-surface" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications"
            description="You're all caught up."
          />
        ) : (
          <>
            <Card>
              <ul className="divide-y divide-line">
                {notifications.map((notif) => {
                  const incId = notif.incidentId?._id || notif.incidentId;
                  const isUnread = !notif.readAt;
                  return (
                    <li key={notif._id}>
                      <div
                        className={cn(
                          "flex items-start gap-3 px-4 py-3 transition-colors",
                          isUnread ? "bg-accent-soft/20" : ""
                        )}
                      >
                        {/* Unread dot */}
                        <div className="mt-1.5 shrink-0">
                          {isUnread ? (
                            <span className="block h-2 w-2 rounded-full bg-accent" />
                          ) : (
                            <span className="block h-2 w-2 rounded-full bg-transparent" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "text-sm font-medium",
                                isUnread ? "text-fg" : "text-fg-muted"
                              )}
                            >
                              {notif.title || notif.eventType}
                            </span>
                            {notif.severity && (
                              <Badge tone={SEVERITY_TONES[notif.severity] || "neutral"}>
                                {notif.severity}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-fg-muted">
                            {notif.eventType?.replace(/_/g, " ")} ·{" "}
                            {notif.createdAt
                              ? new Date(notif.createdAt).toLocaleString()
                              : "just now"}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex shrink-0 items-center gap-1.5">
                          {incId && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              icon={ExternalLink}
                              onClick={() => goToIncident(notif)}
                              aria-label="Go to incident"
                            />
                          )}
                          {isUnread && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              icon={CheckCheck}
                              loading={markingRead === notif._id}
                              onClick={() => markRead(notif._id)}
                              aria-label="Mark as read"
                            />
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-fg-muted">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={ChevronLeft}
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    aria-label="Previous page"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={ChevronRight}
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label="Next page"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
