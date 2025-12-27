import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Search,
  Send,
  User,
  Instagram,
  MessageCircle,
  Radio,
  X,
  FileText,
  Zap,
  Tag,
  StickyNote,
} from "lucide-react";
import api from "../services/api.service";
import { useToast } from "../components/Toast";
import { useTheme } from "../context/ThemeContext";

// Canned Responses Templates
const CANNED_RESPONSES = {
  greetings: [
    {
      id: 1,
      title: "Welcome",
      text: "Hi! Welcome to our store. How can I help you today?",
    },
    {
      id: 2,
      title: "Good Morning",
      text: "Good morning! Thank you for reaching out. What can I do for you?",
    },
    {
      id: 3,
      title: "Thanks for Contact",
      text: "Thank you for contacting us! We're here to help.",
    },
  ],
  pricing: [
    {
      id: 4,
      title: "Price Inquiry",
      text: "The price for this product is ₹{price}. Would you like to place an order?",
    },
    {
      id: 5,
      title: "Bulk Discount",
      text: "For bulk orders (10+ items), we offer special discounts. Please share the quantity you need.",
    },
    {
      id: 6,
      title: "Payment Methods",
      text: "We accept: UPI, Credit/Debit Card, Net Banking, and Cash on Delivery.",
    },
  ],
  shipping: [
    {
      id: 7,
      title: "Delivery Time",
      text: "Standard delivery takes 3-5 business days. Express delivery is available for metro cities (1-2 days).",
    },
    {
      id: 8,
      title: "Shipping Charges",
      text: "Free shipping on orders above ₹500. For orders below ₹500, shipping is ₹50.",
    },
    {
      id: 9,
      title: "Track Order",
      text: "Your order is on the way! Track it here: {tracking_link}",
    },
  ],
  support: [
    {
      id: 10,
      title: "Return Policy",
      text: "We offer a 7-day return policy. Items must be unused and in original packaging.",
    },
    {
      id: 11,
      title: "Exchange",
      text: "Yes, we can exchange the product within 7 days if there's a size/color issue.",
    },
    {
      id: 12,
      title: "Checking Status",
      text: "Let me check the status for you. Please give me a moment...",
    },
  ],
  closing: [
    {
      id: 13,
      title: "Anything Else",
      text: "Is there anything else I can help you with?",
    },
    {
      id: 14,
      title: "Thank You",
      text: "Thank you for shopping with us! Have a great day! 😊",
    },
    {
      id: 15,
      title: "Order Confirmation",
      text: "Your order has been confirmed! You'll receive a confirmation message shortly.",
    },
  ],
};

const Messages = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all"); // all, whatsapp, instagram
  const [loading, setLoading] = useState(true);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastPlatform, setBroadcastPlatform] = useState("all"); // all, whatsapp, instagram
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [showCannedResponses, setShowCannedResponses] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("greetings");
  const { error, success } = useToast();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await api.get("/messages/conversations");
      if (response.success) {
        setConversations(response.data);
      }
    } catch (err) {
      error(err.message || "Failed to fetch conversations");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (customerId) => {
    try {
      const response = await api.get(`/messages/${customerId}`);
      if (response.success) {
        setMessages(response.data);
      }
    } catch (err) {
      error(err.message || "Failed to fetch messages");
    }
  };

  const selectConversation = (conversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation.customer._id);
    setMessageInput("");
    setShowCannedResponses(false);
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;

    try {
      await api.post("/messages/send", {
        customerId: selectedConversation.customer._id,
        platform: selectedConversation.platform,
        content: {
          text: messageInput,
        },
      });

      setMessageInput("");
      fetchMessages(selectedConversation.customer._id);
      success("Message sent!");
    } catch (err) {
      error(err.message || "Failed to send message");
    }
  };

  const insertCannedResponse = (text) => {
    setMessageInput(text);
    setShowCannedResponses(false);
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      error("Please enter a message");
      return;
    }

    try {
      setSendingBroadcast(true);

      // Filter conversations based on selected platform
      const targetConversations = conversations.filter((conv) => {
        if (broadcastPlatform === "all") return true;
        return conv.platform === broadcastPlatform;
      });

      if (targetConversations.length === 0) {
        error("No conversations found for the selected platform");
        return;
      }

      // Send message to all filtered conversations
      const promises = targetConversations.map((conv) =>
        api.post("/messages/send", {
          customerId: conv.customer._id,
          platform: conv.platform,
          content: {
            text: broadcastMessage,
          },
        })
      );

      await Promise.all(promises);

      success(
        `Broadcast message sent to ${targetConversations.length} user(s)!`
      );
      setIsBroadcastModalOpen(false);
      setBroadcastMessage("");
      setBroadcastPlatform("all");
    } catch (err) {
      error(err.message || "Failed to send broadcast message");
    } finally {
      setSendingBroadcast(false);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    // Filter by search term
    const matchesSearch =
      conv.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.customer?.phone?.includes(searchTerm);

    // Filter by platform
    const matchesPlatform =
      platformFilter === "all" || conv.platform === platformFilter;

    return matchesSearch && matchesPlatform;
  });

  return (
    <div className="h-screen -m-4 sm:-m-6 lg:-m-8 overflow-hidden">
      <div
        className={`h-full flex overflow-hidden ${
          isDarkMode
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-gray-100"
        }`}
      >
        {/* Conversations List */}
        <div
          className={`w-1/3 border-r flex flex-col overflow-hidden ${
            isDarkMode ? "border-gray-700" : "border-gray-200"
          }`}
        >
          {/* Header */}
          <div
            className={`p-4 border-b ${
              isDarkMode ? "border-gray-700" : "border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                className={`text-xl font-bold ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                Messages
              </h2>
              <button
                onClick={() => setIsBroadcastModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                <Radio className="w-4 h-4" />
                Broadcast
              </button>
            </div>

            {/* Platform Filter */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setPlatformFilter("all")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  platformFilter === "all"
                    ? "bg-indigo-600 text-white"
                    : isDarkMode
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setPlatformFilter("whatsapp")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  platformFilter === "whatsapp"
                    ? "bg-green-600 text-white"
                    : isDarkMode
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </button>
              <button
                onClick={() => setPlatformFilter("instagram")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  platformFilter === "instagram"
                    ? "bg-pink-600 text-white"
                    : isDarkMode
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Instagram className="w-4 h-4" />
                Instagram
              </button>
            </div>

            <div className="relative">
              <Search
                className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                  isDarkMode ? "text-gray-500" : "text-gray-400"
                }`}
              />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none ${
                  isDarkMode
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                }`}
              />
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No conversations found</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv._id}
                  onClick={() => selectConversation(conv)}
                  className={`p-3 cursor-pointer transition-all duration-200 border-l-4 ${
                    isDarkMode
                      ? `hover:bg-gray-750 ${
                          selectedConversation?._id === conv._id
                            ? "bg-gray-750 border-l-indigo-500"
                            : "border-l-transparent"
                        }`
                      : `hover:bg-gray-50 ${
                          selectedConversation?._id === conv._id
                            ? "bg-indigo-50/50 border-l-indigo-500"
                            : "border-l-transparent"
                        }`
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-full bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold text-base shadow-md">
                        {conv.customer?.name?.charAt(0)?.toUpperCase() || "U"}
                      </div>
                      {/* Platform Badge */}
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center shadow-lg ${
                          conv.platform === "whatsapp"
                            ? "bg-green-500"
                            : "bg-pink-500"
                        }`}
                      >
                        {conv.platform === "whatsapp" ? (
                          <MessageCircle className="w-3 h-3 text-white" />
                        ) : (
                          <Instagram className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between mb-0.5">
                        <p
                          className={`font-semibold text-sm truncate ${
                            isDarkMode ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {conv.customer?.name || "Unknown"}
                        </p>
                        <span
                          className={`text-xs ml-2 shrink-0 ${
                            isDarkMode ? "text-gray-500" : "text-gray-400"
                          }`}
                        >
                          {conv.lastMessageTime &&
                          !isNaN(new Date(conv.lastMessageTime))
                            ? new Date(conv.lastMessageTime).toLocaleString(
                                "en-IN",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )
                            : "Now"}
                        </span>
                      </div>
                      <p
                        className={`text-xs truncate ${
                          isDarkMode ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        {conv.lastMessage?.text || "No messages yet"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div
                className={`p-4 border-b flex items-center gap-3 shadow-sm ${
                  isDarkMode
                    ? "border-gray-700 bg-gray-800"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold shadow-md">
                    {selectedConversation.customer?.name
                      ?.charAt(0)
                      ?.toUpperCase() || "U"}
                  </div>
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center shadow-lg ${
                      selectedConversation.platform === "whatsapp"
                        ? "bg-green-500"
                        : "bg-pink-500"
                    }`}
                  >
                    {selectedConversation.platform === "whatsapp" ? (
                      <MessageCircle className="w-3 h-3 text-white" />
                    ) : (
                      <Instagram className="w-3 h-3 text-white" />
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <p
                    className={`font-semibold text-base ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {selectedConversation.customer?.name || "Unknown"}
                  </p>
                  <div
                    className={`flex items-center gap-1.5 text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    <span>{selectedConversation.customer?.phone}</span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div
                className={`flex-1 overflow-y-auto p-6 space-y-3 ${
                  isDarkMode ? "bg-gray-900" : "bg-gray-50"
                }`}
              >
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare
                      className={`w-12 h-12 mx-auto mb-4 ${
                        isDarkMode ? "text-gray-600" : "text-gray-400"
                      }`}
                    />
                    <p
                      className={isDarkMode ? "text-gray-400" : "text-gray-600"}
                    >
                      No messages yet
                    </p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message._id}
                      className={`flex ${
                        message.direction === "outgoing"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] px-4 py-2.5 rounded-2xl shadow-sm ${
                          message.direction === "outgoing"
                            ? "bg-indigo-600 text-white rounded-br-md"
                            : isDarkMode
                            ? "bg-gray-800 text-white border border-gray-700 rounded-bl-md"
                            : "bg-white text-gray-900 border border-gray-200 rounded-bl-md"
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
                          {message.content?.text || ""}
                        </p>
                        <p
                          className={`text-xs mt-1.5 ${
                            message.direction === "outgoing"
                              ? "text-indigo-100"
                              : isDarkMode
                              ? "text-gray-400"
                              : "text-gray-500"
                          }`}
                        >
                          {message.timestamp &&
                          !isNaN(new Date(message.timestamp))
                            ? new Date(message.timestamp).toLocaleString(
                                "en-IN",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )
                            : "Just now"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Message Input */}
              <div
                className={`border-t ${
                  isDarkMode
                    ? "border-gray-700 bg-gray-800"
                    : "border-gray-200 bg-white"
                }`}
              >
                {/* Canned Responses Panel */}
                {showCannedResponses && (
                  <div
                    className={`p-4 border-b ${
                      isDarkMode
                        ? "border-gray-700 bg-gray-750"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4
                        className={`text-sm font-semibold flex items-center gap-2 ${
                          isDarkMode ? "text-gray-200" : "text-gray-700"
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                        Quick Replies
                      </h4>
                      <button
                        onClick={() => setShowCannedResponses(false)}
                        className={`${
                          isDarkMode
                            ? "text-gray-400 hover:text-gray-300"
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Category Tabs */}
                    <div className="flex gap-2 mb-3 overflow-x-auto">
                      {Object.keys(CANNED_RESPONSES).map((category) => (
                        <button
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                            selectedCategory === category
                              ? "bg-indigo-600 text-white"
                              : isDarkMode
                              ? "bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600"
                              : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
                          }`}
                        >
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </button>
                      ))}
                    </div>

                    {/* Response Templates */}
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {CANNED_RESPONSES[selectedCategory].map((response) => (
                        <button
                          key={response.id}
                          onClick={() => insertCannedResponse(response.text)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors group ${
                            isDarkMode
                              ? "bg-gray-800 border-gray-700 hover:border-indigo-500 hover:bg-gray-700"
                              : "bg-white border-gray-200 hover:border-indigo-500 hover:bg-indigo-50"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p
                                className={`text-sm font-medium mb-1 ${
                                  isDarkMode ? "text-gray-200" : "text-gray-900"
                                }`}
                              >
                                {response.title}
                              </p>
                              <p
                                className={`text-xs line-clamp-2 ${
                                  isDarkMode ? "text-gray-400" : "text-gray-600"
                                }`}
                              >
                                {response.text}
                              </p>
                            </div>
                            <Zap className="w-4 h-4 text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input Area */}
                <div
                  className={`p-4 ${isDarkMode ? "bg-gray-800" : "bg-white"}`}
                >
                  <div className="flex items-end gap-3">
                    <button
                      onClick={() =>
                        setShowCannedResponses(!showCannedResponses)
                      }
                      className={`p-2.5 rounded-lg transition-all ${
                        showCannedResponses
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/50"
                          : isDarkMode
                          ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                      title="Quick Replies"
                    >
                      <FileText className="w-5 h-5" />
                    </button>
                    <div className="flex-1">
                      <textarea
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder="Type a message... (Shift+Enter for new line)"
                        rows={1}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none ${
                          isDarkMode
                            ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                            : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                        }`}
                        style={{ minHeight: "44px", maxHeight: "120px" }}
                      />
                    </div>
                    <button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim()}
                      className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/50 disabled:shadow-none"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div
              className={`flex-1 flex items-center justify-center ${
                isDarkMode ? "bg-gray-900" : "bg-gray-50"
              }`}
            >
              <div className="text-center">
                <MessageSquare
                  className={`w-16 h-16 mx-auto mb-4 ${
                    isDarkMode ? "text-gray-600" : "text-gray-400"
                  }`}
                />
                <p
                  className={`text-lg font-medium mb-2 ${
                    isDarkMode ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  Select a conversation
                </p>
                <p
                  className={`text-sm ${
                    isDarkMode ? "text-gray-500" : "text-gray-500"
                  }`}
                >
                  Choose a conversation from the list to view messages
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Broadcast Message Modal */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Radio className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Broadcast Message
                  </h3>
                  <p className="text-sm text-gray-500">
                    Send a message to all connected users
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBroadcastModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Platform Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Select Platform
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setBroadcastPlatform("all")}
                    className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
                      broadcastPlatform === "all"
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    All Users
                  </button>
                  <button
                    onClick={() => setBroadcastPlatform("whatsapp")}
                    className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      broadcastPlatform === "whatsapp"
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp Only
                  </button>
                  <button
                    onClick={() => setBroadcastPlatform("instagram")}
                    className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      broadcastPlatform === "instagram"
                        ? "bg-pink-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <Instagram className="w-4 h-4" />
                    Instagram Only
                  </button>
                </div>
              </div>

              {/* Recipients Count */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <p className="text-sm text-indigo-900">
                  <span className="font-semibold">
                    {
                      conversations.filter((conv) =>
                        broadcastPlatform === "all"
                          ? true
                          : conv.platform === broadcastPlatform
                      ).length
                    }{" "}
                    user(s)
                  </span>{" "}
                  will receive this message
                </p>
              </div>

              {/* Message Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Type your broadcast message here..."
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                />
                <p className="text-xs text-gray-500 mt-2">
                  {broadcastMessage.length} characters
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setIsBroadcastModalOpen(false)}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSendBroadcast}
                disabled={sendingBroadcast || !broadcastMessage.trim()}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sendingBroadcast ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Broadcast
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
