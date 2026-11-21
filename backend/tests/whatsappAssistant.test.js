const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");
const assistant = require("../src/services/whatsappAssistant.service");
const sharedCache = require("../src/utils/sharedCache");
const whatsappApi = require("../src/utils/whatsapp.api");

after(async () => {
  await sharedCache.close();
});

test("account, payment, invoice, and order questions stay outside Gemini", () => {
  for (const question of [
    "What are my dues?",
    "Where is my order?",
    "Send the invoice",
    "Was my payment received?",
  ]) {
    assert.equal(assistant._isSensitiveQuestion(question), true, question);
    assert.match(
      assistant._localReply({ aiConfig: { language: "english" } }, question, []),
      /team will check/i,
    );
  }
  assert.equal(assistant._isSensitiveQuestion("What is the price of a phone?"), false);
});

test("Gemini prompt redacts common email and phone patterns", () => {
  const prompt = assistant._redactContactDetails(
    "Contact me at customer@example.com or +91 98765 43210",
  );
  assert.equal(prompt.includes("customer@example.com"), false);
  assert.equal(prompt.includes("98765"), false);
  assert.match(prompt, /\[email\]/);
  assert.match(prompt, /\[phone\]/);
});

test("shared catalog cache reuses results and invalidates a shop prefix", async () => {
  const prefix = `whatsapp-catalog-test:${Date.now()}:`;
  let computations = 0;
  const compute = async () => ({ count: ++computations });

  try {
    assert.deepEqual(await sharedCache.remember(`${prefix}phones`, 10000, compute), {
      count: 1,
    });
    assert.deepEqual(await sharedCache.remember(`${prefix}phones`, 10000, compute), {
      count: 1,
    });
    await sharedCache.deletePrefix(prefix);
    assert.deepEqual(await sharedCache.remember(`${prefix}phones`, 10000, compute), {
      count: 2,
    });
  } finally {
    await sharedCache.deletePrefix(prefix);
  }
});

test("typing indicator marks the incoming WhatsApp message as read", async () => {
  const originalPost = axios.post;
  let request;
  axios.post = async (...args) => {
    request = args;
    return { data: { success: true } };
  };

  try {
    await whatsappApi.sendTypingIndicator("phone-id", "secret-token", "wamid.incoming");
    assert.match(request[0], /phone-id\/messages$/);
    assert.deepEqual(request[1], {
      messaging_product: "whatsapp",
      status: "read",
      message_id: "wamid.incoming",
      typing_indicator: { type: "text" },
    });
    assert.equal(request[2].headers.Authorization, "Bearer secret-token");
  } finally {
    axios.post = originalPost;
  }
});
