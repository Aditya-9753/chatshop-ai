const superAdmin = require("../services/superAdmin.service");
const ResponseHandler = require("../utils/response.handler");
const audit = require("../utils/audit");

// Wrap a handler so errors become a 400 with the message
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    console.error(`Super admin error (${req.method} ${req.originalUrl}):`, error.message);
    return ResponseHandler.badRequest(res, error.message);
  }
};

exports.billing = handle(async (req, res) => ResponseHandler.success(res, await superAdmin.billing()));

exports.extendSubscription = handle(async (req, res) => {
  const shop = await superAdmin.extendSubscription(req.params.id, req.body.days);
  await audit(req, "subscription.extend", { target: shop.email, details: `+${req.body.days} days` });
  return ResponseHandler.success(res, shop, `Plan extended by ${req.body.days} days`);
});

exports.impersonate = handle(async (req, res) => {
  const session = await superAdmin.impersonate(req.params.id, req.user);
  await audit(req, "shop.impersonate", { target: session.user.email, details: "Opened the shop dashboard" });
  return ResponseHandler.success(res, session, `Opening ${session.user.name}'s dashboard`);
});
