import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Search,
  Send,
  User,
  Instagram,
  MessageCircle,
} from "lucide-react";
import axios from "axios";
import { useToast } from "../components/Toast";

const Messages = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const { error } = useToast();

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/messages/conversations`
      );
      if (response.data.success) {
        setConversations(response.data.data);
      }
    } catch (err) {
      error(err.response?.data?.message || "Failed to fetch conversations");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (customerId) => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/messages/${customerId}`
      );
      if (response.data.success) {
        setMessages(response.data.data);
      }
    } catch (err) {
      error(err.response?.data?.message || "Failed to fetch messages");
    }
  };

  const selectConversation = (conversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation.customer._id);
  };

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.customer?.phone?.includes(searchTerm)
  );

  return (
    <div className="h-[calc(100vh-8rem)]">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-full flex">
        {/* Conversations List */}
        <div className="w-1/3 border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Messages</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
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
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                    selectedConversation?._id === conv._id ? "bg-indigo-50" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {conv.customer?.name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-gray-900 truncate">
                          {conv.customer?.name || "Unknown"}
                        </p>
                        {conv.platform === "whatsapp" ? (
                          <MessageCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <Instagram className="w-4 h-4 text-pink-600 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        {conv.lastMessage || "No messages yet"}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {conv.lastMessageTime
                          ? new Date(conv.lastMessageTime).toLocaleString(
                              "en-IN",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : ""}
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
              <div className="p-4 border-b border-gray-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-semibold">
                  {selectedConversation.customer?.name
                    ?.charAt(0)
                    ?.toUpperCase() || "U"}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">
                    {selectedConversation.customer?.name || "Unknown"}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>{selectedConversation.customer?.phone}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      {selectedConversation.platform === "whatsapp" ? (
                        <>
                          <MessageCircle className="w-3 h-3" />
                          WhatsApp
                        </>
                      ) : (
                        <>
                          <Instagram className="w-3 h-3" />
                          Instagram
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No messages yet</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message._id}
                      className={`flex ${
                        message.direction === "outbound"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-md px-4 py-2 rounded-lg ${
                          message.direction === "outbound"
                            ? "bg-indigo-600 text-white"
                            : "bg-white text-gray-900 border border-gray-200"
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            message.direction === "outbound"
                              ? "text-indigo-200"
                              : "text-gray-500"
                          }`}
                        >
                          {new Date(message.timestamp).toLocaleString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                  <button className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-lg font-medium mb-2">
                  Select a conversation
                </p>
                <p className="text-gray-500 text-sm">
                  Choose a conversation from the list to view messages
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
