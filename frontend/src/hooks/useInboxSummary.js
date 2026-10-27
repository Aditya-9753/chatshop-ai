import { useCallback, useEffect, useState } from "react";
import { fetchConversations } from "../services/message.service";
import { useRealtime } from "../services/realtime";

/**
 * Unread chats for the sidebar badge and the notifications menu.
 * Loaded once, then kept current by realtime events.
 */
export default function useInboxSummary() {
  const [conversations, setConversations] = useState([]);

  const load = useCallback(async () => {
    try {
      const response = await fetchConversations();
      setConversations(response.data || []);
    } catch {
      // The badge is not worth an error toast; it refreshes on the next event
    }
  }, []);

  useEffect(() => {
    load();
    // Opening a chat elsewhere resets its unread count
    window.addEventListener("inbox:changed", load);
    return () => window.removeEventListener("inbox:changed", load);
  }, [load]);

  useRealtime("message:new", ({ conversation }) => {
    if (!conversation) return;
    setConversations((current) => [conversation, ...current.filter((c) => c._id !== conversation._id)]);
  });

  const unread = conversations
    .filter((c) => c.unreadCount > 0)
    .sort((a, b) => new Date(b.lastMessage?.timestamp || 0) - new Date(a.lastMessage?.timestamp || 0));

  return {
    unreadChats: unread,
    unreadCount: unread.reduce((sum, c) => sum + c.unreadCount, 0),
    refresh: load,
  };
}
