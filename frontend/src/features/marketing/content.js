// Marketing copy shared by the landing page and the help chatbot, so the
// two always agree. Keep claims to what the product does today.

export const TRIAL_DAYS = 14;

export const PRICING = [
  {
    key: "starter",
    name: "Starter",
    price: 499,
    originalPrice: 999,
    blurb: "For a shop getting started on WhatsApp.",
    features: ["One inbox for WhatsApp, Instagram & Facebook", "Customers and product catalog", "Orders and printable invoices", "Email support"],
  },
  {
    key: "business",
    name: "Business",
    price: 1249,
    originalPrice: 2499,
    popular: true,
    blurb: "For shops selling every day in chat.",
    features: ["Everything in Starter", "Broadcast messages", "Analytics with period comparison", "Quick replies and internal notes", "AI replies when they launch"],
  },
  {
    key: "premium",
    name: "Premium",
    price: 4000,
    originalPrice: 8000,
    blurb: "For growing teams with high volume.",
    features: ["Everything in Business", "Low-stock alerts on the dashboard", "Priority support", "Help setting up the WhatsApp Cloud API"],
  },
  {
    key: "one-time",
    name: "Done for you",
    price: 10000,
    originalPrice: 20000,
    oneTime: true,
    blurb: "We set everything up for you.",
    features: ["Channels connected and tested", "Your catalog imported", "Training for your team", "30 days of support"],
  },
];

export const FAQS = [
  {
    q: "How long does setup take?",
    a: "Most shops are live within an hour. Connecting WhatsApp needs a Meta Business account with Cloud API access; after that you paste your phone number ID and token in Settings → Channels.",
    keywords: ["setup", "set up", "start", "begin", "how long", "connect"],
  },
  {
    q: "Which WhatsApp API do you use?",
    a: "Meta's official WhatsApp Cloud API. Messages arrive in your inbox in real time, and you see sent, delivered and read ticks for every reply.",
    keywords: ["whatsapp", "api", "cloud", "meta"],
  },
  {
    q: "Can I use Instagram and Facebook too?",
    a: "Yes. Instagram DMs and Facebook Messenger land in the same inbox, each marked with its channel. Customers are matched across conversations automatically.",
    keywords: ["instagram", "facebook", "messenger", "channel"],
  },
  {
    q: "Do you support COD and UPI?",
    a: "You can record orders as cash on delivery, UPI or Razorpay and track whether each one is paid. Payment links sent in chat are coming soon.",
    keywords: ["cod", "upi", "payment", "pay", "razorpay", "cash"],
  },
  {
    q: "Is there a free trial?",
    a: `Every new workspace gets ${TRIAL_DAYS} days of the Premium plan for free. No card needed.`,
    keywords: ["trial", "free", "demo", "try", "test"],
  },
  {
    q: "Is my data safe?",
    a: "Every webhook is checked against Meta's signature before it's accepted, platform access tokens never leave the server, and passwords are stored hashed. Changing your password logs out every other device.",
    keywords: ["safe", "secure", "security", "privacy", "data"],
  },
  {
    q: "Does it reply automatically with AI?",
    a: "AI replies are on the way. You can already choose the language (English, Hindi or Hinglish) and tone in Settings, and they'll apply when the feature launches.",
    keywords: ["ai", "automatic", "auto", "bot", "language", "hindi", "hinglish"],
  },
];
