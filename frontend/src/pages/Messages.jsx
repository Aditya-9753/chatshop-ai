import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import * as messageService from "../services/message.service";
import customerService from "../services/customer.service";
import { useRealtime } from "../services/realtime";
import { useToast } from "../components/Toast";
import { cn, Drawer, EmptyState } from "../components/ui";
import ConversationList from "../features/inbox/ConversationList";
import ChatThread from "../features/inbox/ChatThread";
import Composer from "../features/inbox/Composer";
import CustomerPanel from "../features/inbox/CustomerPanel";
import BroadcastModal from "../features/inbox/BroadcastModal";
import { formatCurrency } from "../utils/format";

const PANEL_KEY = "inbox-panel-open";

const customerIdOf = (conversation) => conversation?.customerId?._id || conversation?.customerId;

// Insert or replace a message, keeping the thread in time order
const upsert = (messages, message) => {
  const index = messages.findIndex((m) => m._id === message._id);
  if (index >= 0) {
    const next = [...messages];
    next[index] = { ...next[index], ...message };
    return next;
  }
  return [...messages, message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

// Tell the sidebar badge to refresh its unread count
const notifyInboxChanged = () => window.dispatchEvent(new Event("inbox:changed"));

const Messages = () => {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [listState, setListState] = useState({ loading: true, error: null });
  const [messages, setMessages] = useState([]);
  const [threadState, setThreadState] = useState({ loading: false, error: null });
  const [panelOpen, setPanelOpen] = useState(() => localStorage.getItem(PANEL_KEY) !== "0");
  const [panelDrawerOpen, setPanelDrawerOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  // A customer opened from elsewhere who has no conversation yet
  const [draftConversation, setDraftConversation] = useState(null);

  const selectedCustomerId = params.get("customer");
  const existing = useMemo(
    () => conversations.find((c) => String(customerIdOf(c)) === selectedCustomerId) || null,
    [conversations, selectedCustomerId]
  );
  const selected =
    existing || (draftConversation && String(customerIdOf(draftConversation)) === selectedCustomerId ? draftConversation : null);

  useEffect(() => {
    if (!selectedCustomerId || existing || listState.loading) return;
    customerService
      .getCustomer(selectedCustomerId)
      .then((res) =>
        setDraftConversation({
          _id: `draft-${res.data._id}`,
          customerId: res.data,
          platform: res.data.platform,
          status: "open",
          unreadCount: 0,
        })
      )
      .catch(() => setParams({}));
  }, [selectedCustomerId, existing, listState.loading, setParams]);

  const loadConversations = useCallback(async () => {
    setListState((s) => ({ ...s, error: null }));
    try {
      const response = await messageService.fetchConversations();
      setConversations(response.data || []);
      setListState({ loading: false, error: null });
    } catch (err) {
      setListState({ loading: false, error: err.message || "Please try again." });
    }
  }, []);

  const loadMessages = useCallback(async (customerId) => {
    setThreadState({ loading: true, error: null });
    try {
      const response = await messageService.getCustomerMessages(customerId);
      setMessages(response.data || []);
      setThreadState({ loading: false, error: null });
      // Opening the chat marks it read on the server
      setConversations((list) =>
        list.map((c) => (String(customerIdOf(c)) === String(customerId) ? { ...c, unreadCount: 0 } : c))
      );
      notifyInboxChanged();
    } catch (err) {
      setThreadState({ loading: false, error: err.message || "Please try again." });
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedCustomerId) loadMessages(selectedCustomerId);
    else setMessages([]);
  }, [selectedCustomerId, loadMessages]);

  // Live updates: new messages (both directions) and delivery statuses
  useRealtime("message:new", ({ message, conversation }) => {
    const viewing = String(message.customerId) === selectedCustomerId;
    if (conversation) {
      const next = viewing && message.direction === "incoming" ? { ...conversation, unreadCount: 0 } : conversation;
      setConversations((list) => [next, ...list.filter((c) => c._id !== conversation._id)]);
      if (viewing && message.direction === "incoming") {
        messageService.markConversationAsRead(conversation._id).then(notifyInboxChanged).catch(() => {});
      }
    }
    if (viewing) setMessages((list) => upsert(list, message));
  });

  useRealtime("message:status", ({ messageId, status, errorDetails }) => {
    setMessages((list) => list.map((m) => (m._id === messageId ? { ...m, status, errorDetails } : m)));
  });

  const select = (conversation) => setParams({ customer: String(customerIdOf(conversation)) });
  const back = () => setParams({});

  const togglePanel = () => {
    if (window.matchMedia("(min-width: 1280px)").matches) {
      setPanelOpen((open) => {
        localStorage.setItem(PANEL_KEY, open ? "0" : "1");
        return !open;
      });
    } else {
      setPanelDrawerOpen(true);
    }
  };

  // Every send path ends here; the server answers with sent or failed
  const send = async (payload, conversation = selected) => {
    const response = await messageService.sendMessage({
      customerId: customerIdOf(conversation),
      platform: conversation.platform,
      ...payload,
    });
    const message = response.data;
    if (String(customerIdOf(conversation)) === selectedCustomerId) {
      setMessages((list) => upsert(list, message));
    }
    // The first message created the real conversation
    if (String(conversation._id).startsWith("draft-")) loadConversations();
    return message;
  };

  const sendReporting = async (payload) => {
    try {
      const message = await send(payload);
      if (message.status === "failed") {
        toast.error("Message not delivered", { description: message.errorDetails?.message });
      }
    } catch (err) {
      toast.error(err.message || "Couldn't send the message");
    }
  };

  const sendFile = async (file, caption) => {
    try {
      const upload = await messageService.uploadMessageMedia(file);
      const type = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("audio/")
            ? "audio"
            : "document";
      await sendReporting({ type, content: { ...upload.data, text: caption || undefined } });
    } catch (err) {
      toast.error(err.message || "Couldn't upload the file");
    }
  };

  const sendVoice = (blob) => sendFile(new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || "audio/webm" }));

  const sendProduct = (product) => {
    const lines = [`*${product.name}*`, formatCurrency(product.price)];
    if (product.description) lines.push(product.description);
    if (product.stock <= 0) lines.push("Currently out of stock");
    return sendReporting({ type: "product", content: { text: lines.join("\n") } });
  };

  const retry = async (message) => {
    try {
      const response = await messageService.retryMessage(message._id);
      setMessages((list) => upsert(list, response.data));
      if (response.data.status === "failed") toast.error("Still not delivered", { description: response.data.errorDetails?.message });
    } catch (err) {
      toast.error(err.message || "Retry failed");
    }
  };

  const edit = async (message, text) => {
    try {
      const response = await messageService.editMessage(message._id, text);
      setMessages((list) => upsert(list, response.data));
    } catch (err) {
      toast.error(err.message || "Couldn't edit the message");
    }
  };

  const remove = async (message) => {
    try {
      await messageService.deleteMessage(message._id);
      setMessages((list) => list.filter((m) => m._id !== message._id));
    } catch (err) {
      toast.error(err.message || "Couldn't delete the message");
    }
  };

  const setStatus = async (status) => {
    if (selected._id.startsWith("draft-")) return;
    try {
      const response = await messageService.updateConversationStatus(selected._id, status);
      setConversations((list) => list.map((c) => (c._id === selected._id ? { ...c, status: response.data.status } : c)));
      toast.success(status === "closed" ? "Conversation closed" : "Conversation reopened");
    } catch (err) {
      toast.error(err.message || "Couldn't update the conversation");
    }
  };

  const broadcastTo = async (conversation, text) => {
    try {
      const message = await send({ type: "text", content: { text } }, conversation);
      return message.status !== "failed";
    } catch {
      return false;
    }
  };

  const lastIncomingAt = useMemo(
    () => [...messages].reverse().find((m) => m.direction === "incoming")?.createdAt,
    [messages]
  );

  return (
    <div className="flex h-full">
      <aside
        className={cn(
          "h-full w-full shrink-0 border-r border-line bg-surface md:flex md:w-80 md:flex-col",
          selected ? "hidden" : "flex flex-col"
        )}
      >
        <ConversationList
          conversations={conversations}
          loading={listState.loading}
          error={listState.error}
          onRetry={loadConversations}
          selectedId={selected?._id}
          onSelect={select}
          onBroadcast={() => setBroadcastOpen(true)}
        />
      </aside>

      {selected ? (
        <ChatThread
          conversation={selected}
          messages={messages}
          loading={threadState.loading}
          error={threadState.error}
          onRetryLoad={() => loadMessages(selectedCustomerId)}
          onBack={back}
          onTogglePanel={togglePanel}
          onSetStatus={setStatus}
          onRetryMessage={retry}
          onEditMessage={edit}
          onDeleteMessage={remove}
          composer={
            <Composer
              conversation={selected}
              lastIncomingAt={lastIncomingAt}
              onSendText={(text) => sendReporting({ type: "text", content: { text } })}
              onSendFile={sendFile}
              onSendVoice={sendVoice}
              onSendProduct={sendProduct}
            />
          }
        />
      ) : (
        <div className="hidden flex-1 items-center justify-center bg-canvas md:flex">
          <EmptyState
            icon={MessageSquare}
            title="Select a conversation"
            description="Pick a chat on the left to read and reply. New messages appear here instantly."
          />
        </div>
      )}

      {selected && panelOpen && (
        <aside className="hidden h-full w-80 shrink-0 overflow-y-auto scrollbar-thin border-l border-line bg-surface xl:block">
          <CustomerPanel customerId={customerIdOf(selected)} platform={selected.platform} onClose={togglePanel} />
        </aside>
      )}

      {selected && (
        <Drawer open={panelDrawerOpen} onOpenChange={setPanelDrawerOpen} title="Customer" width="sm:max-w-sm">
          <div className="-m-5">
            <CustomerPanel customerId={customerIdOf(selected)} platform={selected.platform} />
          </div>
        </Drawer>
      )}

      <BroadcastModal open={broadcastOpen} onOpenChange={setBroadcastOpen} conversations={conversations} onSend={broadcastTo} />
    </div>
  );
};

export default Messages;
