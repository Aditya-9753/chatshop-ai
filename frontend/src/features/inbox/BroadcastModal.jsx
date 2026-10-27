import React, { useMemo, useState } from "react";
import { Alert, Button, Modal, Select, Textarea } from "../../components/ui";

const CHANNELS = [
  { value: "all", label: "All channels" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
];

/**
 * Send one message to every open conversation on a channel. Messages go
 * out one by one through the normal send pipeline, so each gets its own
 * delivery status in the thread.
 */
export default function BroadcastModal({ open, onOpenChange, conversations, onSend }) {
  const [channel, setChannel] = useState("all");
  const [text, setText] = useState("");
  const [progress, setProgress] = useState(null); // { done, total, failed }

  const recipients = useMemo(
    () => conversations.filter((c) => c.status !== "closed" && (channel === "all" || c.platform === channel)),
    [conversations, channel]
  );

  const sending = progress && progress.done < progress.total;

  const send = async () => {
    const message = text.trim();
    if (!message || recipients.length === 0) return;

    let failed = 0;
    setProgress({ done: 0, total: recipients.length, failed: 0 });
    for (const [index, conversation] of recipients.entries()) {
      const ok = await onSend(conversation, message);
      if (!ok) failed += 1;
      setProgress({ done: index + 1, total: recipients.length, failed });
    }
  };

  const close = (next) => {
    if (sending) return;
    onOpenChange(next);
    if (!next) {
      setProgress(null);
      setText("");
    }
  };

  const finished = progress && !sending;

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title="Broadcast a message"
      description="Send the same message to every open conversation on a channel."
      footer={
        finished ? (
          <Button onClick={() => close(false)}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => close(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={send} loading={sending} disabled={!text.trim() || recipients.length === 0}>
              {sending ? `Sending ${progress.done}/${progress.total}` : `Send to ${recipients.length}`}
            </Button>
          </>
        )
      }
    >
      {finished ? (
        <Alert tone={progress.failed ? "warning" : "success"} title={`Sent to ${progress.total - progress.failed} of ${progress.total}`}>
          {progress.failed > 0 && "Failed messages are marked in their chats with the reason and a Retry button."}
        </Alert>
      ) : (
        <div className="flex flex-col gap-4">
          <Select label="Channel" value={channel} onChange={(e) => setChannel(e.target.value)} options={CHANNELS} disabled={sending} />
          <Textarea
            label="Message"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Our festive sale starts tomorrow: 20% off everything!"
            disabled={sending}
            hint={`${recipients.length} recipient${recipients.length === 1 ? "" : "s"}. WhatsApp only delivers free-form messages to customers who wrote in the last 24 hours.`}
          />
        </div>
      )}
    </Modal>
  );
}
