import React from "react";
import { Crown, Calendar, Zap, Star } from "lucide-react";
import { Link } from "react-router-dom";

const SubscriptionBadge = ({ user, size = "md", showDetails = false }) => {
  const subscription = user?.subscription;
  const plan = subscription?.plan || "free";
  const status = subscription?.status || "inactive";

  // Calculate days remaining
  const getDaysRemaining = () => {
    if (!subscription?.endDate) return 0;
    const end = new Date(subscription.endDate);
    const now = new Date();
    const diff = end - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const daysRemaining = getDaysRemaining();

  // Plan configurations
  const planConfig = {
    free: {
      label: "Free",
      color: "gray",
      gradient: "from-gray-400 to-gray-500",
      icon: Star,
      bgColor: "bg-gray-100",
      textColor: "text-gray-700",
      borderColor: "border-gray-300",
    },
    starter: {
      label: "Starter",
      color: "blue",
      gradient: "from-blue-400 to-blue-600",
      icon: Zap,
      bgColor: "bg-blue-50",
      textColor: "text-blue-700",
      borderColor: "border-blue-300",
    },
    business: {
      label: "Business",
      color: "purple",
      gradient: "from-purple-400 to-purple-600",
      icon: Star,
      bgColor: "bg-purple-50",
      textColor: "text-purple-700",
      borderColor: "border-purple-300",
    },
    premium: {
      label: "Premium",
      color: "yellow",
      gradient: "from-yellow-400 to-yellow-600",
      icon: Crown,
      bgColor: "bg-gradient-to-r from-yellow-50 to-amber-50",
      textColor: "text-yellow-700",
      borderColor: "border-yellow-400",
    },
    "one-time": {
      label: "One-Time",
      color: "green",
      gradient: "from-green-400 to-green-600",
      icon: Zap,
      bgColor: "bg-green-50",
      textColor: "text-green-700",
      borderColor: "border-green-300",
    },
  };

  const config = planConfig[plan] || planConfig.free;
  const Icon = config.icon;

  // Compact badge
  if (!showDetails) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${config.bgColor} ${config.borderColor} border`}
      >
        <Icon className={`w-4 h-4 ${config.textColor}`} />
        <span className={`text-xs font-semibold ${config.textColor}`}>
          {config.label}
        </span>
        {status === "active" && (
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        )}
      </div>
    );
  }

  // Detailed card - Compact version
  return (
    <div
      className={`rounded-lg ${config.bgColor} ${config.borderColor} border p-3 space-y-2`}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center text-white shadow`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3
              className={`font-semibold text-sm ${config.textColor} truncate`}
            >
              {config.label}
            </h3>
            {status === "active" && (
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0"></span>
            )}
          </div>
          {status === "active" && subscription?.endDate && (
            <p className="text-xs text-gray-500">{daysRemaining} days left</p>
          )}
        </div>
      </div>

      {/* Compact progress bar */}
      {status === "active" && subscription?.endDate && (
        <div className="w-full bg-gray-200 rounded-full h-1">
          <div
            className={`h-1 rounded-full bg-gradient-to-r ${config.gradient} transition-all duration-500`}
            style={{
              width: `${Math.min(100, (daysRemaining / 365) * 100)}%`,
            }}
          ></div>
        </div>
      )}

      {/* Compact action button */}
      {plan === "free" || status !== "active" ? (
        <Link
          to="/pricing"
          className={`block w-full text-center px-3 py-1.5 rounded-md bg-gradient-to-r ${config.gradient} text-white text-xs font-semibold hover:shadow transition-all`}
        >
          Upgrade
        </Link>
      ) : daysRemaining <= 14 ? (
        <Link
          to="/pricing"
          className={`block w-full text-center px-3 py-1.5 rounded-md border ${config.borderColor} text-xs font-semibold hover:bg-white/50 transition-all`}
        >
          Renew
        </Link>
      ) : null}
    </div>
  );
};

export default SubscriptionBadge;
