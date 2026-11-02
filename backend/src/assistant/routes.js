const express = require("express");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const { protect } = require("../middleware/auth.middleware");
const { isAdmin, superAdminOnly } = require("../middleware/admin.middleware");
const assistant = require("./service");

// Website help chat (public: visitors aren't signed in)
const router = express.Router();

// Each AI reply costs money: a visitor gets a few messages a minute
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.ASSISTANT_RATE_LIMIT) || 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Thoda ruk kar dobara poochiye. / Please wait a moment and try again." },
});

const ChatIn = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1000) }))
    .min(1)
    .max(30)
    .refine((m) => m[m.length - 1]?.role === "user", "The last message must be the visitor's"),
});

router.post("/chat", limiter, async (req, res) => {
  try {
    const parsed = ChatIn.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    const result = await assistant.chat(parsed.data.messages);
    // Visitors see the answer only, never why the AI failed
    res.json({ success: true, data: { reply: result.reply, source: result.source, provider: result.source === "ai" ? result.provider : undefined } });
  } catch (error) {
    console.error("Assistant error:", error);
    res.status(500).json({ success: false, message: "Abhi jawab nahi de pa raha. / I can't answer right now." });
  }
});

// Super Admin: is the AI working, and a test chat that doesn't count in the stats
const admin = express.Router();
admin.use(protect, isAdmin, superAdminOnly);

admin.get("/status", async (req, res) => {
  try {
    res.json({ success: true, data: await assistant.status() });
  } catch (error) {
    console.error("Assistant status error:", error);
    res.status(500).json({ success: false, message: "Couldn't load the assistant status" });
  }
});

admin.post("/test", async (req, res) => {
  try {
    const parsed = ChatIn.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    res.json({ success: true, data: await assistant.chat(parsed.data.messages, { track: false }) });
  } catch (error) {
    console.error("Assistant test error:", error);
    res.status(500).json({ success: false, message: "The test chat failed" });
  }
});

module.exports = { router, admin };
