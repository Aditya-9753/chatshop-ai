// Shared helpers for the Meta Graph API (WhatsApp, Instagram, Facebook)

const GRAPH_API_URL =
  process.env.META_GRAPH_API_URL || "https://graph.facebook.com/v23.0";

// An error that carries a machine-readable code next to the message,
// so failed sends can store both on the message's errorDetails.
class ChannelError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Turn an axios error from the Graph API into a ChannelError that keeps
// Meta's own error code and text (shown to the user on failed messages).
function toMetaError(error, fallbackMessage) {
  const metaError = error.response?.data?.error;
  if (!metaError) {
    return new ChannelError(error.code || "NETWORK_ERROR", fallbackMessage);
  }

  const details = metaError.error_data?.details;
  const message =
    details && details !== metaError.message
      ? `${metaError.message} (${details})`
      : metaError.message || fallbackMessage;

  return new ChannelError(String(metaError.code || "META_ERROR"), message);
}

// Meta downloads attachments from our server, so the URL must be public.
function toPublicMediaUrl(mediaUrl) {
  if (!mediaUrl) return mediaUrl;
  if (/^https?:\/\//i.test(mediaUrl)) return mediaUrl;

  const base = process.env.PUBLIC_BASE_URL;
  if (!base) {
    throw new ChannelError(
      "MEDIA_NOT_PUBLIC",
      "Attachments need a public URL. Set PUBLIC_BASE_URL on the server so the platform can download the file."
    );
  }
  return `${base.replace(/\/$/, "")}/${mediaUrl.replace(/^\//, "")}`;
}

module.exports = { GRAPH_API_URL, ChannelError, toMetaError, toPublicMediaUrl };
