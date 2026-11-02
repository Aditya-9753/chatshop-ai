// ChatShop AI website assistant: built-in answers and the AI path
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startApp, stopApp } = require("./helpers");

let app, assistant;
const rules = require("../src/assistant/rules");

const FACTS = {
  plans: [
    { name: "Starter", price: "₹499 per month", blurb: "For a shop getting started.", features: ["One inbox"] },
    { name: "Business", price: "₹1,249 per month", blurb: "", features: ["Broadcasts"] },
    { name: "Premium", price: "₹4,000 per month", blurb: "", features: ["Priority support"] },
  ],
  trialDays: 14,
  supportEmail: "help@example.com",
  supportPhone: "",
};
const say = (...turns) => {
  const history = [];
  let last = "";
  for (const t of turns) {
    history.push({ role: "user", content: t });
    last = rules.reply(history, FACTS);
    history.push({ role: "assistant", content: last });
  }
  return last;
};

before(async () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  app = await startApp("chatshop-test-assistant");
  // The app loads backend/.env: never call a real AI from tests
  delete process.env.GEMINI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ASSISTANT_PROVIDER;
  assistant = require("../src/assistant/service");
});
after(stopApp);

test("picks up a name in Hinglish, English and Hindi, and leaves ordinary words alone", () => {
  assert.equal(rules.detectName("mera naam Aditya hai"), "Aditya");
  assert.equal(rules.detectName("Hi, I am rahul"), "Rahul");
  assert.equal(rules.detectName("my name is Priya, what does it cost?"), "Priya");
  assert.equal(rules.detectName("main Sunil hoon"), "Sunil");
  assert.equal(rules.detectName("मेरा नाम राहुल है"), "राहुल");
  assert.equal(rules.detectName("I am looking for a billing app"), null);
  assert.equal(rules.detectName("I am interested"), null);
  assert.equal(rules.detectName("price kitna hai"), null);
});

test("answers in the visitor's language and remembers the name", () => {
  const hi = say("mera naam Aditya hai");
  assert.match(hi, /Namaste Aditya ji/);
  assert.match(hi, /ChatShop AI/);
  assert.match(say("Hi, I am Rahul"), /^Hi Rahul! .*I'm ChatShop AI/);
  assert.match(say("mera naam Aditya hai", "thank you"), /You're welcome, Aditya/);
  assert.match(say("mera naam Aditya hai", "shukriya"), /swagat hai Aditya ji/);
});

test("explains the product, what it does, plans and the trial", () => {
  assert.match(say("ChatShop kya hai?"), /ek hi inbox/);
  const features = say("esko use krke kya kya kr sakta hu");
  assert.match(features, /GST invoice/);
  assert.match(features, /udhaar/);
  assert.match(say("price kitna hai"), /Starter: ₹499 per month[\s\S]*Premium/);
  assert.match(say("Premium plan me kya milta hai"), /^Premium plan: ₹4,000[\s\S]*Priority support/);
  assert.match(say("is there a free trial?"), /14 days/);
  assert.match(say("do you support instagram"), /^Yes: WhatsApp/);
  // "business" in everyday talk isn't the Business plan
  assert.match(say("mera business kirana ka hai, kya kya milega"), /Kirana ke liye/);
  assert.doesNotMatch(say("mera business kirana ka hai, kya kya milega"), /kis cheez ki hai/);
  assert.match(say("main Sunil hoon, cement ka business karta hu"), /Namaste Sunil ji[\s\S]*Cement/);
  assert.match(say("contact number?"), /help@example\.com/);
});

test("route: built-in answers without an API key; validates input", async () => {
  assert.equal(assistant.aiEnabled(), false);
  const res = await request(app).post("/api/assistant/chat").send({ messages: [{ role: "user", content: "mera naam Aditya hai" }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.source, "rules");
  assert.match(res.body.data.reply, /Aditya ji/);

  // Plan prices come from the database
  const price = await request(app).post("/api/assistant/chat").send({ messages: [{ role: "user", content: "price kitna hai" }] });
  assert.match(price.body.data.reply, /Business: ₹1,249/);

  assert.equal((await request(app).post("/api/assistant/chat").send({ messages: [] })).status, 400);
  assert.equal((await request(app).post("/api/assistant/chat").send({ messages: [{ role: "assistant", content: "hi" }] })).status, 400);
  assert.equal((await request(app).post("/api/assistant/chat").send({ messages: [{ role: "user", content: "x".repeat(1001) }] })).status, 400);
});

test("route: with an API key Claude answers; a refusal or an API failure falls back", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ASSISTANT_PROVIDER = "claude";
  let sent = null;
  let mode = "ok";
  const Anthropic = require("@anthropic-ai/sdk");
  assistant._setClient({
    beta: {
      messages: {
        create: async (params) => {
          sent = params;
          if (mode === "error") throw new Error("network down");
          if (mode === "refusal") return { stop_reason: "refusal", content: [] };
          return { stop_reason: "end_turn", content: [{ type: "text", text: "Namaste Aditya ji! Main ChatShop AI hoon." }] };
        },
      },
    },
  });
  try {
    const history = [
      { role: "assistant", content: "Namaste! Main ChatShop AI hoon." }, // the widget's greeting is dropped: chats start with the visitor
      { role: "user", content: "mera naam Aditya hai" },
    ];
    const ok = await request(app).post("/api/assistant/chat").send({ messages: history.slice(1) });
    assert.equal(ok.body.data.source, "ai");
    assert.match(ok.body.data.reply, /Aditya ji/);
    assert.equal(sent.model, "claude-opus-5-5");
    assert.equal(sent.output_config.effort, "low");
    assert.equal(sent.fallbacks, "default");
    assert.match(sent.system, /ChatShop AI/);
    assert.match(sent.system, /Business: ₹1,249 per month/); // live plan prices
    assert.equal(sent.messages[0].role, "user");

    mode = "refusal";
    const refused = await request(app).post("/api/assistant/chat").send({ messages: [{ role: "user", content: "price kitna hai" }] });
    assert.equal(refused.body.data.source, "rules");
    mode = "error";
    const failed = await request(app).post("/api/assistant/chat").send({ messages: [{ role: "user", content: "ChatShop kya hai?" }] });
    assert.equal(failed.status, 200);
    assert.equal(failed.body.data.source, "rules");
    assert.ok(Anthropic); // typed errors are checked with the real SDK classes
  } finally {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ASSISTANT_PROVIDER;
    assistant._setClient(null);
  }
});

test("route: Gemini answers when chosen; a busy model passes to the next, total failure falls back", async () => {
  process.env.GEMINI_API_KEY = "test-gemini";
  process.env.ASSISTANT_PROVIDER = "gemini";
  process.env.GEMINI_MODEL = "busy-model,good-model";
  const calls = [];
  let mode = "ok";
  assistant._setGemini({
    models: {
      generateContent: async (params) => {
        calls.push(params);
        if (mode === "down" || params.model === "busy-model") throw Object.assign(new Error("high demand"), { status: 503 });
        if (mode === "blocked") return { text: "", candidates: [{ finishReason: "SAFETY" }] };
        return { text: "Namaste Aditya ji! Main ChatShop AI hoon.", candidates: [{ finishReason: "STOP" }] };
      },
    },
  });
  try {
    assert.equal(assistant.provider(), "gemini");
    const res = await request(app)
      .post("/api/assistant/chat")
      .send({ messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "Namaste!" }, { role: "user", content: "mera naam Aditya hai" }] });
    assert.equal(res.body.data.source, "ai");
    assert.equal(res.body.data.provider, "gemini");
    assert.deepEqual(calls.map((c) => c.model), ["busy-model", "good-model"]);
    const last = calls[1];
    assert.deepEqual(last.contents.map((c) => c.role), ["user", "model", "user"]);
    assert.match(last.config.systemInstruction, /ChatShop AI/);

    mode = "blocked";
    assert.equal((await request(app).post("/api/assistant/chat").send({ messages: [{ role: "user", content: "price kitna hai" }] })).body.data.source, "rules");
    mode = "down";
    const down = await request(app).post("/api/assistant/chat").send({ messages: [{ role: "user", content: "price kitna hai" }] });
    assert.equal(down.body.data.source, "rules");
    assert.match(down.body.data.reply, /Starter/);
  } finally {
    delete process.env.GEMINI_API_KEY;
    delete process.env.ASSISTANT_PROVIDER;
    delete process.env.GEMINI_MODEL;
    assistant._setGemini(null);
  }
});

test("Super Admin status: which AI, keys, counts, last error; test chat isn't counted", async () => {
  const { registerUser } = require("./helpers");
  const User = require("../src/models/User.model");
  const root = await registerUser(app, { name: "Root", email: "assistant-root@example.com" });
  await User.updateOne({ _id: root.user.id }, { role: "admin" });
  const shop = await registerUser(app, { name: "Shop" });
  const as = (token) => (method, url) => request(app)[method](url).set("Authorization", `Bearer ${token}`);
  const admin = as(root.token);

  assert.equal((await as(shop.token)("get", "/api/admin/assistant/status")).status, 403);
  assert.equal((await request(app).get("/api/admin/assistant/status")).status, 401);
  await admin("put", "/api/admin/admin-panel").send({ password: "Panel@123" });
  const limited = (await request(app).post("/api/auth/login").send({ email: "assistant-root@example.com", password: "Panel@123" })).body.data.token;
  assert.equal((await as(limited)("get", "/api/admin/assistant/status")).status, 403);

  const res = await admin("get", "/api/admin/assistant/status");
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const s = res.body.data;
  assert.equal(s.active, null); // no key in tests
  assert.deepEqual(s.keys, { claude: false, gemini: false });
  assert.equal(s.series.length, 14);
  // Earlier tests in this file: AI answers, built-in answers, failures and a declined reply
  assert.ok(s.today.total >= 8, `today ${JSON.stringify(s.today)}`);
  assert.ok(s.today.ai >= 2);
  assert.ok(s.today.failures >= 2);
  assert.ok(s.today.declined >= 2);
  assert.equal(s.lastError.code, "BUSY");
  assert.equal(s.lastError.provider, "gemini");
  assert.equal(s.lastSuccess.provider, "gemini");
  assert.equal(s.lastSuccess.model, "good-model");

  // The test chat answers but doesn't count
  const before = s.today.total;
  const test = await admin("post", "/api/admin/assistant/test").send({ messages: [{ role: "user", content: "mera naam Aditya hai" }] });
  assert.equal(test.status, 200);
  assert.equal(test.body.data.source, "rules");
  assert.ok(typeof test.body.data.ms === "number");
  assert.equal((await admin("get", "/api/admin/assistant/status")).body.data.today.total, before);

  // Visitors never see why the AI failed
  const visitor = await request(app).post("/api/assistant/chat").send({ messages: [{ role: "user", content: "hi" }] });
  assert.equal(visitor.body.data.error, undefined);
  assert.equal(visitor.body.data.ms, undefined);
});
