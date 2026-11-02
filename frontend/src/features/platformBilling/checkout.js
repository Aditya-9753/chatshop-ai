import { planApi } from "./api";

// Razorpay Checkout is loaded only when someone pays
const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise = null;

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = RAZORPAY_SCRIPT;
      script.onload = resolve;
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("Couldn't load Razorpay. Check your connection and try again."));
      };
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Ask the server until the gateway's confirmation has arrived (or give up)
export async function waitForPayment(ref, { tries = 15, every = 2000 } = {}) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    last = (await planApi.payment(ref)).data;
    if (last.status !== "CREATED") return last;
    await sleep(every);
  }
  return last;
}

/**
 * Open Razorpay Checkout for an order the server created. Resolves with the
 * payment as the server sees it: only the server decides it is paid (from
 * Razorpay's signature plus its own check, or the webhook).
 */
export async function payWithRazorpay(order, { title, description }) {
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.gateway.keyId,
      order_id: order.orderId,
      amount: order.amountPaise,
      currency: order.currency || "INR",
      name: title,
      description,
      prefill: order.prefill,
      theme: { color: "#4f46e5" },
      handler: async (response) => {
        try {
          const verified = (await planApi.verify(response)).data;
          resolve(verified.processing ? await waitForPayment(order.paymentRef) : verified);
        } catch (error) {
          reject(error);
        }
      },
      modal: { ondismiss: () => resolve(null) },
    });
    rzp.on("payment.failed", (event) => reject(new Error(event?.error?.description || "Payment failed")));
    rzp.open();
  });
}
