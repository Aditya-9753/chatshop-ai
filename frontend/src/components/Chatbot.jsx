import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { X, Send, MessageCircle, Minimize2, Bot, Sparkles } from "lucide-react";

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      type: "bot",
      text: "Hi there! 👋 I'm your ChatShop AI assistant. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const { isDarkMode } = useTheme();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Pre-configured responses based on common questions
  const getBotResponse = (userMessage) => {
    const message = userMessage.toLowerCase().trim();

    // Greetings
    if (
      message.includes("hello") ||
      message.includes("hi") ||
      message.includes("hey")
    ) {
      return "Hello! 👋 I'm here to help you with ChatShop AI. What would you like to know about our WhatsApp and Instagram automation platform?";
    }

    // Features
    if (
      message.includes("feature") ||
      message.includes("what can") ||
      message.includes("capabilities")
    ) {
      return "ChatShop AI offers:\n\n✅ WhatsApp Business Integration\n✅ Instagram DM Automation\n✅ AI-Powered Customer Support\n✅ Order Management\n✅ Product Catalog\n✅ Analytics & Insights\n✅ Multi-Channel Management\n\nWhich feature interests you the most?";
    }

    // Pricing
    if (
      message.includes("price") ||
      message.includes("cost") ||
      message.includes("plan") ||
      message.includes("subscription")
    ) {
      return "We offer flexible pricing plans:\n\n📦 **Starter**: ₹999/month - 1,000 messages\n🚀 **Professional**: ₹2,499/month - 5,000 messages\n⭐ **Enterprise**: ₹4,999/month - Unlimited messages\n\nAll plans include WhatsApp & Instagram integration, AI support, and 24/7 customer service!";
    }

    // Setup/Getting Started
    if (
      message.includes("start") ||
      message.includes("setup") ||
      message.includes("begin") ||
      message.includes("how to use")
    ) {
      return "Getting started is easy! 🚀\n\n1. Sign up for an account\n2. Connect your WhatsApp Business number\n3. Link your Instagram account (optional)\n4. Upload your product catalog\n5. Configure automated responses\n6. Start chatting with customers!\n\nWould you like me to walk you through any specific step?";
    }

    // WhatsApp specific
    if (message.includes("whatsapp")) {
      return "Our WhatsApp integration includes:\n\n📱 Automated message responses\n💬 Customer inquiry handling\n📦 Order status updates\n🤖 AI-powered chatbot\n📊 Message analytics\n👥 Multi-agent support\n\nYou can connect your WhatsApp Business API or use our official number!";
    }

    // Instagram specific
    if (message.includes("instagram")) {
      return "Instagram integration features:\n\n📸 DM automation\n💬 Comment responses\n🛍️ Product tagging in chats\n📈 Engagement analytics\n🤝 Seamless customer handoff\n\nManage both Instagram and WhatsApp from one dashboard!";
    }

    // AI specific
    if (message.includes("ai") || message.includes("artificial intelligence")) {
      return "Our AI capabilities:\n\n🤖 Natural language understanding\n💡 Context-aware responses\n📚 Learning from past conversations\n🎯 Intent recognition\n🌐 Multi-language support\n⚡ Real-time responses\n\nThe AI gets smarter as it handles more customer interactions!";
    }

    // Support
    if (
      message.includes("support") ||
      message.includes("help") ||
      message.includes("contact")
    ) {
      return "Need assistance? We're here for you! 🙌\n\n📧 Email: support@chatshop.ai\n📱 Phone: +91-123-456-7890\n💬 Live Chat: Available 24/7\n📖 Documentation: Visit our help center\n\nYou can also reach us through the Contact form on this page!";
    }

    // Demo/Trial
    if (
      message.includes("demo") ||
      message.includes("trial") ||
      message.includes("try") ||
      message.includes("test")
    ) {
      return "We offer a 14-day free trial! 🎉\n\nNo credit card required. Get full access to:\n\n✨ All features\n📊 Complete analytics\n🤖 AI chatbot\n📱 WhatsApp & Instagram integration\n\nSign up now to start your free trial!";
    }

    // Integration
    if (
      message.includes("integrat") ||
      message.includes("connect") ||
      message.includes("api")
    ) {
      return "We integrate with:\n\n🛒 E-commerce platforms (Shopify, WooCommerce)\n💳 Payment gateways (Razorpay, Stripe)\n📦 Shipping providers\n📊 CRM systems\n📧 Email marketing tools\n\nOur REST API also allows custom integrations!";
    }

    // Security/Privacy
    if (
      message.includes("secur") ||
      message.includes("privacy") ||
      message.includes("safe") ||
      message.includes("data")
    ) {
      return "Your data security is our priority! 🔒\n\n✅ End-to-end encryption\n✅ GDPR compliant\n✅ Secure cloud hosting\n✅ Regular security audits\n✅ No data sharing with third parties\n✅ SOC 2 Type II certified\n\nYour customer data is always protected!";
    }

    // How it works
    if (
      message.includes("how does it work") ||
      message.includes("how it work")
    ) {
      return "Here's how ChatShop AI works:\n\n1️⃣ **Connect**: Link your WhatsApp/Instagram\n2️⃣ **Configure**: Set up automated responses and workflows\n3️⃣ **AI Training**: Our AI learns your business context\n4️⃣ **Go Live**: Start receiving and responding to messages\n5️⃣ **Monitor**: Track performance through analytics\n\nThe AI handles routine queries while you focus on complex issues!";
    }

    // Benefits
    if (message.includes("benefit") || message.includes("advantage")) {
      return "Key benefits of ChatShop AI:\n\n⚡ Respond 10x faster to customer queries\n💰 Reduce customer support costs by 60%\n😊 Improve customer satisfaction\n📈 Increase sales conversions\n⏰ 24/7 automated customer support\n🌍 Reach customers on their preferred platform\n\nTransform your customer communication today!";
    }

    // Thank you
    if (
      message.includes("thank") ||
      message.includes("thanks") ||
      message.includes("appreciate")
    ) {
      return "You're welcome! 😊 Is there anything else you'd like to know about ChatShop AI? I'm here to help!";
    }

    // Bye
    if (
      message.includes("bye") ||
      message.includes("goodbye") ||
      message.includes("see you")
    ) {
      return "Goodbye! 👋 Feel free to come back anytime if you have more questions. Have a great day!";
    }

    // Default response
    return "I'm not sure about that specific question, but I'd be happy to help! 🤔\n\nYou can ask me about:\n\n• Features and capabilities\n• Pricing and plans\n• WhatsApp or Instagram integration\n• Getting started\n• AI features\n• Support options\n\nOr, feel free to contact our support team for personalized assistance!";
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage = {
      type: "user",
      text: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    // Simulate bot thinking time
    setTimeout(() => {
      const botResponse = {
        type: "bot",
        text: getBotResponse(inputValue),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botResponse]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1000); // Random delay between 1-2 seconds
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickQuestions = [
    "What features do you offer?",
    "How much does it cost?",
    "How do I get started?",
    "Is there a free trial?",
  ];

  const handleQuickQuestion = (question) => {
    setInputValue(question);
  };

  return (
    <>
      {/* Chatbot Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setIsOpen(true)}
            className="relative w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 group bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 hover:shadow-purple-500/50"
            aria-label="Open Chat"
          >
            <MessageCircle className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative">1</span>
            </span>
            {/* Pulse effect */}
            <span className="absolute inset-0 rounded-full bg-purple-400 opacity-0 group-hover:opacity-20 group-hover:animate-ping"></span>
          </button>
        </div>
      )}

      {/* Chatbot Window */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 w-[360px] h-[550px] rounded-3xl shadow-2xl flex flex-col overflow-hidden z-50 transition-all duration-300 border ${
            isDarkMode
              ? "bg-gray-900 border-gray-700/50"
              : "bg-white border-gray-200/50"
          }`}
          style={{
            animation: "slideUp 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
            backdropFilter: "blur(10px)",
          }}
        >
          {/* Header with gradient */}
          <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-5 overflow-hidden">
            {/* Animated background */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 animate-gradient"></div>

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/30">
                    <Bot className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-400 rounded-full border-2 border-white shadow-lg animate-pulse"></div>
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg flex items-center gap-2">
                    ChatShop AI
                    <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-green-400 rounded-full shadow-lg shadow-green-400/50"></div>
                    <span className="text-white/90 text-xs font-medium">
                      Always Online
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-all duration-200 backdrop-blur-sm"
                  aria-label="Minimize"
                >
                  <Minimize2 className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-all duration-200 backdrop-blur-sm"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>

          {/* Messages Container */}
          <div
            className={`flex-1 overflow-y-auto p-5 space-y-4 ${
              isDarkMode
                ? "bg-gradient-to-b from-gray-900 to-gray-800"
                : "bg-gradient-to-b from-gray-50 to-white"
            }`}
            style={{
              scrollBehavior: "smooth",
            }}
          >
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.type === "user" ? "justify-end" : "justify-start"
                } animate-fadeIn`}
                style={{
                  animation: `fadeIn 0.3s ease-out ${index * 0.1}s both`,
                }}
              >
                {message.type === "bot" && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mr-2 flex-shrink-0 shadow-lg ring-2 ring-purple-200/50">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-5 py-3 whitespace-pre-line shadow-lg ${
                    message.type === "user"
                      ? "bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white rounded-br-md shadow-purple-500/30"
                      : isDarkMode
                      ? "bg-gray-800 text-gray-100 rounded-bl-md shadow-gray-900/50 border border-gray-700/50"
                      : "bg-white text-gray-800 rounded-bl-md shadow-gray-200/50 border border-gray-100"
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.text}</p>
                  <span
                    className={`text-xs mt-2 block ${
                      message.type === "user"
                        ? "text-white/70"
                        : isDarkMode
                        ? "text-gray-500"
                        : "text-gray-400"
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start animate-fadeIn">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mr-2 flex-shrink-0 shadow-lg ring-2 ring-purple-200/50">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div
                  className={`rounded-2xl px-5 py-4 rounded-bl-md shadow-lg ${
                    isDarkMode
                      ? "bg-gray-800 border border-gray-700/50"
                      : "bg-white border border-gray-100"
                  }`}
                >
                  <div className="flex gap-1.5">
                    <div
                      className="w-2.5 h-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    ></div>
                    <div
                      className="w-2.5 h-2.5 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    ></div>
                    <div
                      className="w-2.5 h-2.5 bg-gradient-to-r from-pink-500 to-indigo-600 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions */}
          {messages.length <= 1 && (
            <div
              className={`px-5 py-3 border-t ${
                isDarkMode
                  ? "bg-gray-900 border-gray-800"
                  : "bg-gray-50/50 border-gray-100"
              }`}
            >
              <p
                className={`text-xs font-semibold mb-2.5 flex items-center gap-1.5 ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Quick questions
              </p>
              <div className="flex flex-wrap gap-2">
                {quickQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickQuestion(question)}
                    className={`text-xs px-4 py-2 rounded-full transition-all duration-200 font-medium hover:scale-105 ${
                      isDarkMode
                        ? "bg-gradient-to-r from-gray-800 to-gray-700 text-gray-300 hover:from-indigo-900 hover:to-purple-900 border border-gray-700 hover:border-purple-600"
                        : "bg-white text-gray-700 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 border border-gray-200 hover:border-purple-300 shadow-sm hover:shadow-md"
                    }`}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div
            className={`p-5 border-t ${
              isDarkMode
                ? "bg-gray-900 border-gray-800"
                : "bg-white border-gray-100"
            }`}
          >
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className={`w-full px-5 py-3.5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all duration-200 ${
                    isDarkMode
                      ? "bg-gray-800 text-gray-100 placeholder-gray-500 border border-gray-700 focus:bg-gray-750"
                      : "bg-gray-100 text-gray-800 placeholder-gray-500 border border-gray-200 focus:bg-white shadow-sm"
                  }`}
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim()}
                className={`p-3.5 rounded-2xl transition-all duration-200 flex-shrink-0 ${
                  inputValue.trim()
                    ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:shadow-xl hover:shadow-purple-500/50 hover:scale-105 cursor-pointer"
                    : isDarkMode
                    ? "bg-gray-800 cursor-not-allowed border border-gray-700"
                    : "bg-gray-200 cursor-not-allowed border border-gray-300"
                }`}
              >
                <Send
                  className={`w-5 h-5 ${
                    inputValue.trim() ? "text-white" : "text-gray-500"
                  }`}
                />
              </button>
            </div>

            {/* Powered by text */}
            <div className="mt-3 text-center">
              <p
                className={`text-xs ${
                  isDarkMode ? "text-gray-600" : "text-gray-400"
                }`}
              >
                Powered by{" "}
                <span className="font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  ChatShop AI
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Animation Styles */}
      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes gradient {
          0%,
          100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }

        /* Custom scrollbar */
        div::-webkit-scrollbar {
          width: 6px;
        }

        div::-webkit-scrollbar-track {
          background: transparent;
        }

        div::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #6366f1, #a855f7, #ec4899);
          border-radius: 10px;
        }

        div::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #4f46e5, #9333ea, #db2777);
        }
      `}</style>
    </>
  );
};

export default Chatbot;
