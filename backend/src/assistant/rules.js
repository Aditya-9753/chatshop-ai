// The assistant without an AI model: picks up the visitor's name, answers in
// Hinglish or English, and covers the questions shops actually ask. Used when
// no Anthropic API key is set, or when the AI call fails.

const HINGLISH = /\b(hai|hain|kya|kaise|kese|kaisa|mera|meri|mujhe|mujhko|naam|nam|kitna|kitne|kitni|karna|karte|karo|kar|kr|krna|sakta|sakte|sakti|skta|hoon|hun|hu|aap|ap|apka|aapka|batao|bataiye|btao|chahiye|nahi|nhi|haan|ji|bhai|dukaan|dukan|udhaar|udhar|kaun|kab|kahan|kyu|kyun|ke|ka|ki|ko|se|mein|wala|wali|liye|lie|hindi)\b/i;
const DEVANAGARI = /[ऀ-ॿ]/;

// Words that follow "I am" / "main" but are not names
const NOT_NAMES = new Set(
  "a an the interested looking new here from in at with fine good ok okay shop owner customer trying using asking just not very also going planning ready sure sorry happy thinking wondering seller retailer dukandar dukaandar bhi to toh ek koi ab abhi yahan wahan aapka apka kya".split(" ")
);

const titleCase = (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

/** "mera naam Rahul hai", "my name is Rahul", "main Rahul hoon", "Rahul here" -> "Rahul" */
function detectName(text) {
  const t = String(text || "").trim();
  const patterns = [
    /(?:mera|meraa|mere|apna)\s+(?:naam|nam|name)\s+(?:hai\s+)?([a-zऀ-ॿ]{2,20})/i,
    /(?:मेरा|मेरी)\s+नाम\s+([ऀ-ॿ]{2,20})/,
    /मैं\s+([ऀ-ॿ]{2,20})\s+(?:हूँ|हूं|हु)/,
    /my\s+name\s+is\s+([a-z]{2,20})/i,
    /(?:^|\s)(?:name|naam)\s*[:\-]\s*([a-zऀ-ॿ]{2,20})/i,
    /(?:^|\s)(?:main|mai|mein|me)\s+([a-zऀ-ॿ]{2,20})\s+(?:hoon|hun|hu|hoo)\b/i,
    /^(?:hi|hello|hey|namaste|namaskar)?[\s,!]*(?:i am|i'm|im|this is)\s+([a-z]{2,20})\s*(?:[,.!]|$|here|from|and|\s+se\b)/i,
    /^(?:hi|hello|hey|namaste)?[\s,!]*([a-z]{2,20})\s+(?:here|this side)\b/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m && !NOT_NAMES.has(m[1].toLowerCase())) return DEVANAGARI.test(m[1]) ? m[1] : titleCase(m[1]);
  }
  return null;
}

const ENGLISH = /\b(what|which|how|does|do|is|am|are|name|hello|hey|the|you|your|my|can|could|would|tell|about|please|thanks|thank|cost|need|want|support|it)\b/i;

// The visitor's language from this message; a message with no clue either
// way ("ok", "hi") keeps the language of the conversation so far
const languageOf = (text, earlier = "") => {
  if (DEVANAGARI.test(text) || HINGLISH.test(text)) return "hi";
  if (ENGLISH.test(text)) return "en";
  return DEVANAGARI.test(earlier) || HINGLISH.test(earlier) ? "hi" : "en";
};

const INTENTS = [
  ["thanks", /\b(thanks?|thank you|thx|shukriya|dhanyavad|dhanyawad)\b/i],
  ["pricing", /(price|pricing|cost|plan|kitna|kitne|charges?|fees?|paisa|paise|rate|₹|rupay|rupee|mehenga|sasta|subscription)/i],
  ["trial", /\b(trial|free|muft|demo|try|test)\b/i],
  ["billing", /\b(emi|gst|invoices?|bills?|billing|imei|udhaar|udhar|khata|pay later|credit|kist|installments?|staff|cashier|accountant|counter sale)\b/i],
  ["features", /(kya kya|kya kar|kya kr|features?|what can|can i do|use kar|use kr|kaam|benefit|fayda|faida|help me with|kaise madad|what does it do|offer)/i],
  ["about", /(chatshop kya|what is chatshop|about chatshop|ye kya hai|yeh kya hai|kya hai ye|kya hai yeh|tell me about|batao.*(product|chatshop)|product kya|explain)/i],
  ["setup", /(setup|set up|start|shuru|kaise lu|kaise le|connect|jod|install|signup|sign up|register|account|kaise use)/i],
  ["channels", /(whatsapp|instagram|insta|facebook|messenger|channel)/i],
  ["ai", /\b(ai|auto ?reply|automatic|bot|chatbot)\b/i],
  ["security", /(safe|secure|security|privacy|data|surakshit)/i],
  ["contact", /(contact|support|call|phone number|email|help ?line|baat kar|talk to)/i],
  ["who", /(who are you|kaun ho|aap kaun|tum kaun|your name|tumhara naam|aapka naam)/i],
  ["ack", /^(ok+|okay|acha|accha|achha|theek|thik|hmm+|fine|cool|great|nice|haan|yes|ji|sahi)\b[\s.!]*(hai|h|ji)?[\s.!]*$/i],
  ["greeting", /^(hi+|hello|hey|hii+|namaste|namaskar|good (morning|afternoon|evening)|ram ram|salaam|hola)\b/i],
];

const intentOf = (text) => INTENTS.find(([, re]) => re.test(text))?.[0] || null;

const planLines = (facts) => facts.plans.map((p) => `• ${p.name}: ${p.price}${p.blurb ? `. ${p.blurb}` : ""}`).join("\n");

const REPLIES = {
  intro: {
    hi: (n) => `Namaste ${n} ji! 🙏 Main ChatShop AI hoon. Main aapko ChatShop ke features, plans aur shuru karne ka tarika samjha sakta hoon. Aapka business kis cheez ka hai: mobile, kirana, garments, cement ya kuch aur?`,
    en: (n) => `Hi ${n}! 👋 I'm ChatShop AI. I can walk you through what ChatShop does, the plans, and how to get started. What kind of shop do you run: mobiles, grocery, garments, building material or something else?`,
  },
  greeting: {
    hi: (n) => `Namaste${n ? ` ${n} ji` : ""}! 🙏 Main ChatShop AI hoon. Aap mujhse ChatShop ke features, price, free trial ya setup ke baare me pooch sakte hain.${n ? "" : " Aapka naam kya hai?"}`,
    en: (n) => `Hi${n ? ` ${n}` : ""}! 👋 I'm ChatShop AI. Ask me about ChatShop's features, pricing, the free trial or setup.${n ? "" : " May I know your name?"}`,
  },
  who: {
    hi: () => "Main ChatShop AI hoon, ChatShop ka assistant. Main aapko batata hoon ki ChatShop aapki dukaan ke liye kya kar sakta hai, plans kitne ke hain aur kaise shuru karein.",
    en: () => "I'm ChatShop AI, ChatShop's assistant. I can tell you what ChatShop can do for your shop, what it costs and how to start.",
  },
  about: {
    hi: () =>
      "ChatShop AI dukaanon ke liye ek software hai jisme WhatsApp, Instagram aur Facebook ke saare customer messages ek hi inbox me aate hain. Wahin se aap orders, customers, products aur GST bills sambhal sakte hain, aur chahein to EMI aur udhaar (pay later) ka hisaab bhi. 14 din free trial hai, card ki zarurat nahi.",
    en: () =>
      "ChatShop AI is software for shops that brings every WhatsApp, Instagram and Facebook customer message into one inbox. From there you manage orders, customers, products and GST invoices, plus EMI and pay-later (udhaar) if you need them. There's a 14-day free trial, no card needed.",
  },
  features: {
    hi: () =>
      [
        "ChatShop se aap ye sab kar sakte hain:",
        "• WhatsApp, Instagram, Facebook ke messages ek inbox me, quick replies aur broadcast ke saath",
        "• Customers, products aur stock ka record, low-stock alert",
        "• Chat se ya counter se order, aur printable GST invoice (CGST/SGST/IGST)",
        "• Shop EMI, udhaar (pay later) aur due date pe WhatsApp reminder",
        "• Staff logins (Cashier, Accountant…) aur sales/revenue analytics",
        "Aapki dukaan kis cheez ki hai? Main uske hisaab se bata deta hoon.",
      ].join("\n"),
    en: () =>
      [
        "With ChatShop you can:",
        "• Reply to WhatsApp, Instagram and Facebook messages from one inbox, with quick replies and broadcasts",
        "• Keep customers, products and stock in one place, with low-stock alerts",
        "• Take orders in chat or at the counter and print GST invoices (CGST/SGST/IGST)",
        "• Run Shop EMI and pay-later (udhaar) sales with WhatsApp reminders on the due date",
        "• Give staff their own logins (cashier, accountant…) and see sales analytics",
        "What do you sell? I'll tell you what fits your shop.",
      ].join("\n"),
  },
  pricing: {
    hi: (n, f) => `Plans:\n${planLines(f)}\nHar nayi dukaan ko ${f.trialDays} din Premium free milta hai, card nahi chahiye. Shuru karne ke liye /register par account banaiye.`,
    en: (n, f) => `Plans:\n${planLines(f)}\nEvery new shop gets ${f.trialDays} days of Premium free, no card needed. Start at /register.`,
  },
  trial: {
    hi: (n, f) => `Haan${n ? ` ${n} ji` : ""}! Har nayi dukaan ko ${f.trialDays} din ka Premium plan bilkul free milta hai, card ki zarurat nahi. /register par 1 minute me account ban jata hai.`,
    en: (n, f) => `Yes${n ? `, ${n}` : ""}! Every new shop gets ${f.trialDays} days of the Premium plan free, no card needed. Sign up at /register in about a minute.`,
  },
  billing: {
    hi: () =>
      "ChatShop me EMI & Billing hai: GST tax invoice (CGST/SGST ya IGST), counter sale, mobile ke liye IMEI se stock, Shop EMI (schedule, late fee, WhatsApp reminder) aur udhaar/pay later (due date ke saath, baad me payment lo, reminder bhejo). Cashier, Accountant jaise staff roles bhi hain. Ise dukaan ka owner chalu karta hai aur ChatShop team approve karti hai.",
    en: () =>
      "ChatShop has EMI & Billing: GST tax invoices (CGST/SGST or IGST), counter sales, IMEI stock for phones, Shop EMI (schedule, late fees, WhatsApp reminders) and pay-later sales (due date, collect later, send reminders). Staff roles like cashier and accountant are included. The shop owner turns it on and the ChatShop team approves it.",
  },
  setup: {
    hi: () =>
      "Shuru karna aasaan hai: /register par account banaiye (1 minute). Zyada tar dukaanein 1 ghante me live ho jati hain. WhatsApp ke liye Meta Business account aur WhatsApp Cloud API chahiye; phir Settings → Channels me phone number ID aur token daal dijiye. Instagram aur Facebook bhi wahin se judte hain.",
    en: () =>
      "Getting started is easy: sign up at /register (about a minute). Most shops are live within an hour. WhatsApp needs a Meta Business account with WhatsApp Cloud API access; then paste the phone number ID and token in Settings → Channels. Instagram and Facebook connect from the same page.",
  },
  channels: {
    hi: () => "Haan, WhatsApp (Meta ka official Cloud API), Instagram DMs aur Facebook Messenger, teeno ke messages ek hi inbox me aate hain, har message pe channel ka nishaan ke saath. Sent, delivered aur read ticks bhi dikhte hain.",
    en: () => "Yes: WhatsApp (Meta's official Cloud API), Instagram DMs and Facebook Messenger all land in one inbox, each marked with its channel, with sent, delivered and read ticks.",
  },
  ai: {
    hi: () => "Customers ko automatic AI reply wala feature jaldi aa raha hai. Aap abhi se Settings me uski language (English, Hindi, Hinglish) aur tone chun sakte hain; launch hote hi wahi lagu hoga.",
    en: () => "Automatic AI replies to your customers are coming soon. You can already pick the language (English, Hindi or Hinglish) and tone in Settings, and they'll apply at launch.",
  },
  security: {
    hi: () => "Aapka data surakshit hai: Meta ke har webhook ka signature check hota hai, access tokens kabhi browser tak nahi jaate, passwords hashed rehte hain, aur two-factor login bhi hai.",
    en: () => "Your data is safe: every Meta webhook's signature is checked, access tokens never leave the server, passwords are hashed, and two-factor login is available.",
  },
  contact: {
    hi: (n, f) => (f.supportEmail || f.supportPhone ? `Hamari team se yahan baat kar sakte hain: ${[f.supportEmail, f.supportPhone].filter(Boolean).join(" · ")}.` : "Hamari team se baat karne ke liye website ka contact form use kijiye, ya free trial shuru karke app ke andar se help maangiye."),
    en: (n, f) => (f.supportEmail || f.supportPhone ? `You can reach our team at ${[f.supportEmail, f.supportPhone].filter(Boolean).join(" · ")}.` : "To talk to our team, use the contact form on the website, or start the free trial and ask from inside the app."),
  },
  ack: {
    hi: (n) => `Theek hai${n ? ` ${n} ji` : ""}! Aur kuch jaanna ho to poochiye: features, price, free trial ya setup. Shuru karna ho to /register par 14 din free try kijiye.`,
    en: (n) => `Great${n ? `, ${n}` : ""}! Ask me anything else: features, pricing, the free trial or setup. When you're ready, try it free for 14 days at /register.`,
  },
  thanks: {
    hi: (n) => `Aapka swagat hai${n ? ` ${n} ji` : ""}! 😊 Aur kuch poochna ho to batayiye.`,
    en: (n) => `You're welcome${n ? `, ${n}` : ""}! 😊 Anything else I can help with?`,
  },
  unknown: {
    hi: () => "Ye main abhi sahi se nahi bata paunga. Aap mujhse pooch sakte hain: ChatShop kya hai, isse kya kya kar sakte hain, price kitna hai, free trial, ya setup kaise karein.",
    en: () => "I'm not sure about that one. You can ask me what ChatShop is, what you can do with it, pricing, the free trial, or how to set it up.",
  },
};

// Business types: a line that fits the visitor's trade
const TRADES = [
  [/(mobile|phone|electronic)/i, { hi: "Mobile shop ke liye: IMEI se stock, Shop EMI aur GST bill bahut kaam aate hain.", en: "For a mobile shop: IMEI stock, Shop EMI and GST invoices fit perfectly." }],
  [/(cement|sariya|steel|hardware|building|construction|tiles)/i, { hi: "Cement/building material ke liye: bulk GST invoice (IGST bhi), pay later aur due date reminders kaam aate hain.", en: "For building material: bulk GST invoices (IGST too), pay-later and due-date reminders fit well." }],
  [/(kirana|grocery|general store|provision)/i, { hi: "Kirana ke liye: udhaar khata (pay later), stock aur WhatsApp par order lena kaam aata hai.", en: "For a grocery store: pay-later (udhaar khata), stock and WhatsApp orders fit well." }],
  [/(garment|cloth|kapda|kapde|fashion|boutique|saree|readymade)/i, { hi: "Garments ke liye: catalog, Instagram/WhatsApp orders aur GST bill (5%/12%) kaam aate hain.", en: "For garments: catalog, Instagram/WhatsApp orders and GST invoices (5%/12%) fit well." }],
];

/**
 * Reply to the last user message. `history` is [{ role, content }] oldest
 * first; the name is remembered from anywhere in it.
 */
function reply(history, facts) {
  const userTurns = history.filter((m) => m.role === "user").map((m) => String(m.content || ""));
  const text = userTurns[userTurns.length - 1] || "";
  const lang = languageOf(text, userTurns.slice(-3, -1).join(" "));
  const newName = detectName(text);
  const name = newName || userTurns.slice(0, -1).reverse().map(detectName).find(Boolean) || null;

  const intent = intentOf(text);
  const trade = TRADES.find(([re]) => re.test(text))?.[1];

  const tryIt = lang === "hi" ? "14 din free trial se khud dekh lijiye: /register" : "Try it free for 14 days: /register";

  // Just introduced themselves: greet by name (and their trade, if they said it)
  if (newName && (!intent || intent === "greeting")) {
    if (!trade) return REPLIES.intro[lang](newName);
    const hello = lang === "hi" ? `Namaste ${newName} ji! 🙏 Main ChatShop AI hoon.` : `Hi ${newName}! 👋 I'm ChatShop AI.`;
    return `${hello}\n${trade[lang]} ${tryIt}`;
  }
  if (trade && !intent) return `${trade[lang]} ${tryIt}`;

  // A plan asked about by name: just that plan
  // ("business" is also everyday talk, so only when the question is about plans)
  const asksPlan = intent === "pricing" || /\b(plan|pack|package)\b/i.test(text);
  const plan = asksPlan && facts.plans.find((p) => text.toLowerCase().includes(p.name.toLowerCase()));
  if (plan && ["pricing", "features", null].includes(intent)) {
    const lines = plan.features.map((x) => `• ${x}`).join("\n");
    const head = `${plan.name} plan: ${plan.price}.${plan.blurb ? ` ${plan.blurb}` : ""}`;
    return lang === "hi"
      ? `${head}\nIsme milta hai:\n${lines}\n${facts.trialDays} din ke free trial me Premium ke saare features chala ke dekh sakte hain: /register`
      : `${head}\nIt includes:\n${lines}\nTry every Premium feature free for ${facts.trialDays} days: /register`;
  }

  let answer = (REPLIES[intent] || REPLIES.unknown)[lang](name, facts);
  // Their trade is known: say what fits it instead of asking for it
  if (trade && intent === "features") answer = answer.split("\n").slice(0, -1).concat(trade[lang]).join("\n");
  const opener = newName ? (lang === "hi" ? `Namaste ${newName} ji! 🙏 Main ChatShop AI hoon.\n` : `Hi ${newName}! 👋 I'm ChatShop AI.\n`) : "";
  return opener + answer;
}

module.exports = { reply, detectName, languageOf, intentOf };
