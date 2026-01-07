import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Moon, Sun } from "lucide-react";
import Chatbot from "../components/Chatbot";

const Logo = () => (
  <div className="flex items-center gap-3 hover:scale-105 transition-transform duration-300">
    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
      WA
    </div>
    <div className="leading-tight">
      <div className="font-bold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
        ChatShop AI
      </div>
      <div className="text-xs text-gray-500">
        WhatsApp + Instagram + Facebook
      </div>
    </div>
  </div>
);

function Navbar({ isAuthenticated, user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`py-4 px-6 flex items-center justify-between transition-all duration-300 ${
        scrolled
          ? isDarkMode
            ? "bg-gray-800 shadow-lg"
            : "bg-white shadow-lg"
          : isDarkMode
          ? "bg-gray-800/80 backdrop-blur-md shadow-sm"
          : "bg-white/80 backdrop-blur-md shadow-sm"
      } sticky top-0 z-40`}
    >
      <Logo />
      <div className="hidden md:flex gap-8 items-center">
        <a
          href="#features"
          className={`text-sm transition-colors duration-300 font-medium ${
            isDarkMode
              ? "text-gray-300 hover:text-indigo-400"
              : "text-gray-700 hover:text-indigo-600"
          }`}
        >
          Features
        </a>
        <a
          href="#pricing"
          className={`text-sm transition-colors duration-300 font-medium ${
            isDarkMode
              ? "text-gray-300 hover:text-indigo-400"
              : "text-gray-700 hover:text-indigo-600"
          }`}
        >
          Pricing
        </a>
        <a
          href="#faq"
          className={`text-sm transition-colors duration-300 font-medium ${
            isDarkMode
              ? "text-gray-300 hover:text-indigo-400"
              : "text-gray-700 hover:text-indigo-600"
          }`}
        >
          FAQ
        </a>
        <a
          href="#contact"
          className={`px-4 py-2 rounded-lg border-2 border-indigo-600 text-sm font-medium transition-all duration-300 hover:shadow-md ${
            isDarkMode
              ? "text-indigo-400 hover:bg-indigo-900"
              : "text-indigo-600 hover:bg-indigo-50"
          }`}
        >
          Contact
        </a>
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          className={`p-2 rounded-lg transition-colors ${
            isDarkMode
              ? "text-yellow-300 hover:bg-gray-700"
              : "text-gray-600 hover:bg-gray-100"
          }`}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>
        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard/profile")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
              } transition-colors`}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-semibold text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span
                className={`text-sm font-medium ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                {user?.name}
              </span>
            </button>
            <Link to="/dashboard" className="btn-primary">
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <Link to="/login" className="btn-primary">
            Login
          </Link>
        )}
      </div>
      <div className="md:hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`p-2 rounded-lg border ${
            isDarkMode
              ? "border-gray-600 hover:bg-gray-700 text-gray-300"
              : "border-gray-300 hover:bg-gray-100"
          } transition-colors duration-300`}
        >
          ☰
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div
          className={`absolute top-16 left-0 right-0 ${
            isDarkMode ? "bg-gray-800 border-t border-gray-700" : "bg-white"
          } shadow-lg md:hidden animate-slideInDown`}
        >
          <div className="flex flex-col p-4 gap-3">
            <a
              href="#features"
              onClick={() => setIsOpen(false)}
              className={`px-4 py-2 ${
                isDarkMode
                  ? "text-gray-300 hover:text-indigo-400 hover:bg-gray-700"
                  : "text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
              } rounded-lg transition-colors font-medium`}
            >
              Features
            </a>
            <a
              href="#pricing"
              onClick={() => setIsOpen(false)}
              className={`px-4 py-2 ${
                isDarkMode
                  ? "text-gray-300 hover:text-indigo-400 hover:bg-gray-700"
                  : "text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
              } rounded-lg transition-colors font-medium`}
            >
              Pricing
            </a>
            <a
              href="#faq"
              onClick={() => setIsOpen(false)}
              className={`px-4 py-2 ${
                isDarkMode
                  ? "text-gray-300 hover:text-indigo-400 hover:bg-gray-700"
                  : "text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
              } rounded-lg transition-colors font-medium`}
            >
              FAQ
            </a>
            <a
              href="#contact"
              onClick={() => setIsOpen(false)}
              className={`px-4 py-2 rounded-lg border-2 ${
                isDarkMode
                  ? "border-indigo-500 text-indigo-400 hover:bg-indigo-900/30"
                  : "border-indigo-600 text-indigo-600 hover:bg-indigo-50"
              } text-sm font-medium transition-all`}
            >
              Contact
            </a>
            <Link
              to="/login"
              onClick={() => setIsOpen(false)}
              className="btn-primary text-center"
            >
              Login
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

function Hero() {
  const [activeChat, setActiveChat] = useState("whatsapp");
  const { isDarkMode } = useTheme();

  return (
    <header
      className={`${
        isDarkMode
          ? "bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900"
          : "bg-gradient-to-b from-white via-indigo-50/40 to-indigo-50/20"
      } pt-16 pb-20 relative overflow-hidden`}
    >
      {/* Animated Background Elements */}
      <div
        className={`absolute top-0 -left-40 w-80 h-80 ${
          isDarkMode ? "bg-indigo-500/10" : "bg-indigo-300/10"
        } rounded-full blur-3xl animate-pulse`}
      ></div>
      <div
        className={`absolute bottom-0 -right-40 w-80 h-80 ${
          isDarkMode ? "bg-purple-500/10" : "bg-purple-300/10"
        } rounded-full blur-3xl animate-pulse`}
        style={{ animationDelay: "1s" }}
      ></div>

      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center relative z-10">
        <div className="slide-in-left">
          <div
            className={`inline-block mb-4 px-4 py-2 ${
              isDarkMode
                ? "bg-gradient-to-r from-green-900/40 to-blue-900/40"
                : "bg-gradient-to-r from-green-100 to-blue-100"
            } rounded-full hover:shadow-lg transition-all duration-300`}
          >
            <span className="text-sm font-semibold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              🚀 WhatsApp + Instagram + Facebook AI Agents
            </span>
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
            Build a 24/7 AI Shop on WhatsApp, Instagram & Facebook
          </h1>

          <p
            className={`mt-6 text-lg ${
              isDarkMode ? "text-gray-300" : "text-gray-600"
            } leading-relaxed`}
          >
            Instant AI replies, product catalog, order tracking, payment links
            and customer follow-ups — all through WhatsApp, Instagram & Facebook
            DMs Direct Messages. No apps to teach, no training required.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200 hover:shadow-lg transition-all duration-300 hover:scale-105">
              <span className="text-2xl">💬</span>
              <span className="font-semibold text-green-900">
                WhatsApp Automation
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-50 to-purple-100 rounded-lg border border-pink-200 hover:shadow-lg transition-all duration-300 hover:scale-105">
              <span className="text-2xl">📸</span>
              <span className="font-semibold text-purple-900">
                Instagram DM Bot
              </span>
            </div>
          </div>

          <div className="mt-8 flex gap-4 flex-wrap">
            <Link to="/register" className="btn-primary">
              Start Free Trial
            </Link>
            <a href="#features" className="btn-secondary">
              See Features
            </a>
          </div>

          <ul
            className={`mt-8 text-sm ${
              isDarkMode ? "text-gray-300" : "text-gray-700"
            } space-y-3 font-medium`}
          >
            <li className="flex items-center gap-3">
              <span className="text-2xl">✅</span> Setup in 30 minutes
            </li>
            <li className="flex items-center gap-3">
              <span className="text-2xl">✅</span> Works on WhatsApp, Instagram
              & Facebook
            </li>
            <li className="flex items-center gap-3">
              <span className="text-2xl">✅</span> Supports Hinglish, Hindi &
              English
            </li>
          </ul>

          <div
            className={`mt-8 text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            Trusted by neighbourhood shops & local franchises
          </div>
        </div>

        <div className="slide-in-right flex justify-center">
          {/* Phone Mockup */}
          <div className="relative w-80 float-animation">
            {/* Phone Frame */}
            <div
              className="bg-black rounded-3xl border-8 border-black shadow-2xl overflow-hidden pulse-glow"
              style={{ aspectRatio: "9/16" }}
            >
              {/* Phone Screen */}
              <div className="bg-white h-full flex flex-col overflow-hidden">
                {/* Status Bar */}
                <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-2 flex justify-between items-center text-white text-xs font-semibold">
                  <span>9:41</span>
                  <div className="flex gap-1">📶 📡 🔋</div>
                </div>

                {/* Chat Tab Selector */}
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => setActiveChat("whatsapp")}
                    className={`flex-1 py-3 px-4 font-semibold transition-all ${
                      activeChat === "whatsapp"
                        ? "text-green-600 border-b-2 border-green-600 bg-green-50"
                        : "text-gray-600"
                    }`}
                  >
                    💬 WhatsApp
                  </button>
                  <button
                    onClick={() => setActiveChat("instagram")}
                    className={`flex-1 py-3 px-4 font-semibold transition-all ${
                      activeChat === "instagram"
                        ? "text-pink-600 border-b-2 border-pink-600 bg-pink-50"
                        : "text-gray-600"
                    }`}
                  >
                    📸 Instagram
                  </button>
                  <button
                    onClick={() => setActiveChat("facebook")}
                    className={`flex-1 py-3 px-4 font-semibold transition-all ${
                      activeChat === "facebook"
                        ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                        : "text-gray-600"
                    }`}
                  >
                    👍 Facebook
                  </button>
                </div>

                {/* Chat Content */}
                <div className="flex-1 overflow-y-auto p-4 bg-white space-y-3 scrollbar-hide">
                  {activeChat === "whatsapp" ? (
                    <ChatContent platform="whatsapp" />
                  ) : activeChat === "instagram" ? (
                    <ChatContent platform="instagram" />
                  ) : (
                    <ChatContent platform="facebook" />
                  )}
                </div>

                {/* Input Area */}
                <div className="border-t border-gray-200 p-4 bg-white flex gap-2">
                  <input
                    type="text"
                    placeholder="Message..."
                    className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none"
                  />
                  <button className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-green-600 transition-colors">
                    ➤
                  </button>
                </div>
              </div>

              {/* Phone Notch */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-6 bg-black rounded-b-3xl z-10"></div>
            </div>

            {/* Phone Shadow */}
            <div className="absolute -bottom-4 -right-4 w-72 h-96 bg-gradient-to-t from-indigo-600/20 to-transparent rounded-3xl blur-2xl -z-10"></div>
          </div>
        </div>
      </div>
    </header>
  );
}

function ChatContent({ platform }) {
  const whatsappMessages = [
    { side: "left", text: "Namaste! 👋 How can I help you today?" },
    { side: "right", text: "Do you have Redmi 12?" },
    {
      side: "left",
      text: "✨ Yes — Redmi 12 in Blue. Price ₹10,999. COD available. Want to order?",
    },
    { side: "right", text: "Haan, ek phone bhejo" },
    {
      side: "left",
      text: "✅ Order placed! Invoice: #A1234. Delivery in 2–3 days.",
    },
  ];

  const instagramMessages = [
    {
      side: "left",
      text: "Hey! 👋 Welcome to our shop! What are you looking for?",
    },
    { side: "right", text: "Show me latest phones 📱" },
    {
      side: "left",
      text: "📸 Just posted new collection! Check our feed. iPhone 15 Pro ₹99,999",
    },
    { side: "right", text: "That looks nice! Any discounts?" },
    { side: "left", text: "🎉 Yes! 10% off this week. DM me for details!" },
  ];

  const facebookMessages = [
    {
      side: "left",
      text: "Hello! 👋 Thanks for messaging us on Facebook!",
    },
    { side: "right", text: "Do you ship to Mumbai?" },
    {
      side: "left",
      text: "✅ Yes! Free shipping on orders above ₹500. What would you like to order?",
    },
    { side: "right", text: "Samsung Galaxy S23" },
    {
      side: "left",
      text: "🎯 Samsung Galaxy S23 - ₹74,999. In stock! COD available.",
    },
  ];

  const messages =
    platform === "whatsapp"
      ? whatsappMessages
      : platform === "instagram"
      ? instagramMessages
      : facebookMessages;

  return (
    <>
      {messages.map((m, i) => (
        <div
          key={i}
          className={`flex ${
            m.side === "left" ? "justify-start" : "justify-end"
          } animate-fadeIn`}
          style={{ animationDelay: `${i * 0.15}s` }}
        >
          <div
            className={`${
              m.side === "left"
                ? "bg-gray-100 text-gray-900"
                : platform === "whatsapp"
                ? "bg-green-500 text-white"
                : platform === "instagram"
                ? "bg-pink-500 text-white"
                : "bg-blue-600 text-white"
            } px-4 py-2 rounded-2xl max-w-[85%] shadow-md text-sm font-medium`}
          >
            {m.text}
          </div>
        </div>
      ))}
    </>
  );
}

const FeatureCard = ({ title, desc, icon, isDarkMode }) => (
  <div
    className={`p-8 border-2 ${
      isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-100 bg-white"
    } rounded-2xl shadow-md card-hover group overflow-hidden h-full min-h-[200px] flex flex-col`}
  >
    <div
      className={`absolute inset-0 ${
        isDarkMode
          ? "bg-gradient-to-br from-indigo-900/30 to-transparent"
          : "bg-gradient-to-br from-indigo-50 to-transparent"
      } opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
    ></div>
    <div className="flex items-start gap-4 relative z-10 flex-1">
      <div
        className={`w-14 h-14 rounded-xl flex-shrink-0 ${
          isDarkMode
            ? "bg-gradient-to-br from-indigo-900 to-purple-900"
            : "bg-gradient-to-br from-indigo-100 to-purple-100"
        } flex items-center justify-center text-3xl group-hover:scale-110 transition-transform duration-300`}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div
          className={`font-bold text-lg ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          {title}
        </div>
        <div
          className={`text-sm ${
            isDarkMode ? "text-gray-300" : "text-gray-600"
          } mt-3 leading-relaxed`}
        >
          {desc}
        </div>
      </div>
    </div>
  </div>
);

function Features() {
  const { isDarkMode } = useTheme();
  const features = [
    {
      title: "🤖 AI WhatsApp Replies",
      desc: "Auto-respond to customers 24/7 in Hinglish, Hindi & English with smart AI.",
    },
    {
      title: "📸 Instagram DM Bot",
      desc: "Fully automated Instagram Direct Message responses & order handling.",
    },
    {
      title: "👍 Facebook Messenger Bot",
      desc: "Connect with customers on Facebook Messenger with AI-powered responses.",
    },
    {
      title: "🛒 Product Catalog",
      desc: "Send beautiful product cards with images, price and direct Buy buttons.",
    },
    {
      title: "📦 Order Management",
      desc: "Place orders, generate invoices, track status automatically across all platforms.",
    },
    {
      title: "💳 Payment Links",
      desc: "Generate UPI / Razorpay links that customers can pay instantly without leaving chats.",
    },
    {
      title: "📢 Broadcast & Offers",
      desc: "Send festival offers and new-arrival messages to customers on WhatsApp, Instagram & Facebook.",
    },
    {
      title: "📊 Analytics",
      desc: "Weekly reports: top queries, conversion rate, trending products across both platforms.",
    },
    {
      title: "🌐 Multi-Channel",
      desc: "Manage WhatsApp, Instagram & Facebook shops from a single unified dashboard.",
    },
  ];

  return (
    <section
      id="features"
      className={`py-20 ${
        isDarkMode
          ? "bg-gradient-to-b from-gray-900 to-gray-800"
          : "bg-gradient-to-b from-gray-50 to-white"
      } relative overflow-hidden`}
    >
      {/* Animated Background */}
      <div
        className={`absolute top-0 left-0 w-96 h-96 ${
          isDarkMode ? "bg-indigo-500/5" : "bg-indigo-200/5"
        } rounded-full blur-3xl`}
      ></div>
      <div
        className={`absolute bottom-0 right-0 w-96 h-96 ${
          isDarkMode ? "bg-purple-500/5" : "bg-purple-200/5"
        } rounded-full blur-3xl`}
      ></div>

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <div className="slide-in-up text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Everything you need
          </h2>
          <p
            className={`mt-4 text-lg ${
              isDarkMode ? "text-gray-300" : "text-gray-600"
            } max-w-3xl mx-auto`}
          >
            Powerful features for WhatsApp, Instagram & Facebook automation.
            Manage all platforms from one dashboard.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <div
              key={i}
              style={{ animationDelay: `${i * 0.1}s` }}
              className="slide-in-up"
            >
              <FeatureCard
                title={f.title}
                desc={f.desc}
                icon={""}
                isDarkMode={isDarkMode}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingCard({
  title,
  price,
  originalPrice,
  bullets,
  popular,
  isOneTime,
  isDarkMode,
}) {
  return (
    <div
      className={`p-8 rounded-2xl border-2 transition-all duration-300 ${
        popular
          ? isDarkMode
            ? "border-indigo-500 bg-gradient-to-br from-indigo-900/30 to-gray-800 shadow-2xl scale-105"
            : "border-indigo-600 bg-gradient-to-br from-indigo-50 to-white shadow-2xl scale-105"
          : isDarkMode
          ? "border-gray-700 bg-gray-800 shadow-lg hover:shadow-xl"
          : "border-gray-200 bg-white shadow-lg hover:shadow-xl"
      } card-hover group`}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <div
            className={`font-bold text-2xl ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            {title}
          </div>
          <div
            className={`text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            } mt-1 font-medium`}
          >
            {bullets.length} features included
          </div>
        </div>
        {popular && (
          <div className="text-xs px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-bold">
            🔥 Most Popular
          </div>
        )}
        {!popular && (originalPrice || isOneTime) && (
          <div className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-lg font-bold">
            50% OFF
          </div>
        )}
      </div>

      <div className="mb-8">
        <div className="flex items-baseline gap-2">
          {originalPrice && (
            <div
              className={`text-sm ${
                isDarkMode ? "text-gray-500" : "text-gray-400"
              } line-through font-semibold`}
            >
              ₹{originalPrice.toLocaleString("en-IN")}
            </div>
          )}
          <div
            className={`text-3xl font-extrabold ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            ₹{price.toLocaleString("en-IN")}
          </div>
        </div>
        <div
          className={`text-sm ${
            isDarkMode ? "text-gray-400" : "text-gray-600"
          } mt-2 font-medium`}
        >
          {isOneTime ? "one-time setup" : "/month, billed annually"}
        </div>
      </div>

      <ul className="space-y-3 mb-8">
        {bullets.map((b, i) => (
          <li
            key={i}
            className={`text-sm ${
              isDarkMode ? "text-gray-300" : "text-gray-700"
            } font-medium flex items-center gap-3`}
          >
            <span className="text-indigo-600 font-bold">✓</span> {b}
          </li>
        ))}
      </ul>

      <Link
        to="/register"
        className={`block w-full py-3 rounded-xl font-bold transition-all duration-300 text-center ${
          popular
            ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-105"
            : isDarkMode
            ? "border-2 border-indigo-500 text-indigo-400 hover:bg-indigo-900/30"
            : "border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50"
        }`}
      >
        Get Started
      </Link>
    </div>
  );
}

function Pricing() {
  const { isDarkMode } = useTheme();
  const plans = [
    {
      title: "Starter",
      price: 499,
      originalPrice: 999,
      bullets: [
        "AI replies up to 200/month",
        "Basic product catalog",
        "Email support",
      ],
    },
    {
      title: "Business",
      price: 1249,
      originalPrice: 2499,
      bullets: [
        "Unlimited AI replies",
        "Full order system",
        "Weekly broadcasts",
        "Analytics dashboard",
      ],
      popular: true,
    },
    {
      title: "Premium",
      price: 4000,
      originalPrice: 8000,
      bullets: [
        "Everything in Business",
        "Website + WhatsApp",
        "Inventory management",
        "Dedicated support",
      ],
    },
    {
      title: "One-Time",
      price: 10000,
      originalPrice: 20000,
      isOneTime: true,
      bullets: [
        "Complete setup & customization",
        "Full integration with your store",
        "Training & documentation",
        "30 days of free support",
      ],
    },
  ];

  return (
    <section
      id="pricing"
      className={`py-20 ${isDarkMode ? "bg-gray-900" : "bg-white"}`}
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="slide-in-up text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Simple, Transparent Pricing
          </h2>
          <p
            className={`mt-4 text-lg ${
              isDarkMode ? "text-gray-300" : "text-gray-600"
            } max-w-3xl mx-auto`}
          >
            No hidden fees. Scale your plan as your business grows.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((p, i) => (
            <div
              key={i}
              style={{ animationDelay: `${i * 0.1}s` }}
              className="slide-in-up"
            >
              <PricingCard {...p} isDarkMode={isDarkMode} />
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p
            className={`${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            } font-medium`}
          >
            7-day free trial. No credit card required. Cancel anytime.
          </p>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const [openId, setOpenId] = useState(0);
  const { isDarkMode } = useTheme();
  const qas = [
    {
      q: "⏱️ How long does setup take?",
      a: "Most shops are setup within 30–90 minutes. We configure your product list, set up replies, and test everything to make sure it works perfectly.",
    },
    {
      q: "🔌 Which WhatsApp API do you use?",
      a: "We support Meta WhatsApp Cloud API and can integrate intermediary providers like WATI, Zoko, and others.",
    },
    {
      q: "💰 Do you support COD & UPI?",
      a: "Yes! We generate payment links (Razorpay/Cashfree) and record COD orders automatically.",
    },
    {
      q: "🌍 Which languages are supported?",
      a: "We support English, Hindi, Hinglish and are constantly adding more regional languages.",
    },
    {
      q: "🔒 Is my data safe?",
      a: "Absolutely. We use enterprise-grade encryption and comply with WhatsApp policies.",
    },
  ];

  return (
    <section
      id="faq"
      className={`py-20 ${
        isDarkMode
          ? "bg-gradient-to-b from-gray-800 to-gray-900"
          : "bg-gradient-to-b from-gray-50 to-white"
      }`}
    >
      <div className="max-w-4xl mx-auto px-6">
        <div className="slide-in-up text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Common Questions
          </h2>
          <p
            className={`mt-4 text-lg ${
              isDarkMode ? "text-gray-300" : "text-gray-600"
            }`}
          >
            Find answers to what shopkeepers ask us most.
          </p>
        </div>
        <div className="space-y-4">
          {qas.map((qa, i) => (
            <details
              key={i}
              open={openId === i}
              onClick={() => setOpenId(openId === i ? -1 : i)}
              className={`p-6 ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700"
                  : "bg-white border-gray-100"
              } border-2 rounded-xl card-hover cursor-pointer group`}
            >
              <summary
                className={`font-bold text-lg ${
                  isDarkMode ? "text-white" : "text-gray-900"
                } flex items-center justify-between cursor-pointer`}
              >
                <span>{qa.q}</span>
                <span className="text-indigo-600 transform group-hover:rotate-180 transition-transform duration-300">
                  ▼
                </span>
              </summary>
              <div
                className={`mt-4 ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                } leading-relaxed animate-fadeIn`}
              >
                {qa.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  const [formData, setFormData] = useState({ name: "", phone: "", email: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <section
      id="contact"
      className="py-20 bg-gradient-to-r from-indigo-600 to-purple-600 relative overflow-hidden"
    >
      {/* Background Animation */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-40 h-40 bg-white rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-10 right-10 w-40 h-40 bg-white rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
      </div>

      <div className="max-w-3xl mx-auto px-6 text-center slide-in-up relative z-10">
        <h3 className="text-4xl font-extrabold text-white">
          Ready to transform your business?
        </h3>
        <p className="mt-4 text-lg text-indigo-100">
          Book a free 15-minute demo and we'll show you exactly how ChatShop AI
          can help.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10 grid md:grid-cols-3 gap-4"
        >
          <input
            type="text"
            placeholder="Your name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="p-4 border-2 border-white rounded-lg bg-white/20 text-white placeholder-white/70 focus:bg-white focus:text-gray-900 focus:outline-none transition-all duration-300"
          />
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            className="p-4 border-2 border-white rounded-lg bg-white/20 text-white placeholder-white/70 focus:bg-white focus:text-gray-900 focus:outline-none transition-all duration-300"
          />
          <input
            type="tel"
            placeholder="WhatsApp number"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            className="p-4 border-2 border-white rounded-lg bg-white/20 text-white placeholder-white/70 focus:bg-white focus:text-gray-900 focus:outline-none transition-all duration-300"
          />
        </form>

        <button
          onClick={handleSubmit}
          className="mt-6 px-10 py-4 rounded-lg bg-white text-indigo-600 font-bold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
        >
          Book Free Demo
        </button>

        {submitted && (
          <div className="mt-6 p-4 bg-white/20 border border-white rounded-lg text-white font-semibold animate-fadeIn">
            ✅ Thanks! We'll contact you soon.
          </div>
        )}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-12 bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-10 mb-10">
          <div>
            <Logo />
            <p className="mt-4 text-gray-400 text-sm">
              Empowering local businesses with WhatsApp, Instagram & Facebook
              automation.
            </p>
          </div>
          <div>
            <div className="font-bold mb-4">Product</div>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <a
                  href="#features"
                  className="hover:text-indigo-400 transition-colors"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#pricing"
                  className="hover:text-indigo-400 transition-colors"
                >
                  Pricing
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-indigo-400 transition-colors">
                  Security
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="font-bold mb-4">Company</div>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <a href="#" className="hover:text-indigo-400 transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-indigo-400 transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a
                  href="#contact"
                  className="hover:text-indigo-400 transition-colors"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="font-bold mb-4">Legal</div>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <a href="#" className="hover:text-indigo-400 transition-colors">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-indigo-400 transition-colors">
                  Terms
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-indigo-400 transition-colors">
                  Cookies
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-400">
            © 2026 ChatShop AI — Built for Indian businesses
          </div>
          <div className="flex gap-6 text-2xl">
            <a href="#" className="hover:text-indigo-400 transition-colors">
              𝕏
            </a>
            <a href="#" className="hover:text-indigo-400 transition-colors">
              f
            </a>
            <a href="#" className="hover:text-indigo-400 transition-colors">
              in
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  const { isAuthenticated, user, loading } = useAuth();
  const { isDarkMode } = useTheme();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && isAuthenticated) {
      // Use window.location for a clean redirect
      window.location.href = "/dashboard";
    }
  }, [isAuthenticated, loading]);

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDarkMode ? "bg-gray-900" : "bg-white"
        }`}
      >
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Show loading state while redirecting
  if (isAuthenticated) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDarkMode ? "bg-gray-900" : "bg-white"
        }`}
      >
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen overflow-x-hidden ${
        isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-800"
      }`}
    >
      <Navbar isAuthenticated={isAuthenticated} user={user} />
      <main>
        <Hero />
        <Features />
        <Pricing />
        <FAQ />
        <Contact />
      </main>
      <Footer />
      <Chatbot />
    </div>
  );
}
