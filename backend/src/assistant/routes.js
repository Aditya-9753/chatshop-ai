const express = require("express");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
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
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Assistant error:", error);
    res.status(500).json({ success: false, message: "Abhi jawab nahi de pa raha. / I can't answer right now." });
  }
});

module.exports = router;
