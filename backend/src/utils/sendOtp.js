const axios = require("axios");

const normalizeMobile = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  const countryCode = String(process.env.MSG91_COUNTRY_CODE || "91").replace(/\D/g, "");
  if (digits.length === 10) return `${countryCode}${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `${countryCode}${digits.slice(1)}`;
  if (digits.length >= 11 && digits.length <= 15 && !digits.startsWith("0")) return digits;
  throw new Error("Enter a valid mobile number with its country code");
};

module.exports = async (phone, otp) => {
  if (process.env.NODE_ENV === "test") return { skipped: true };
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID;
  if (!authKey || !templateId) {
    if (process.env.NODE_ENV === "development") {
      console.warn("MSG91 is not configured; mobile verification SMS was not sent.");
      return { skipped: true };
    }
    throw new Error("Mobile verification is unavailable. Configure MSG91 and try again.");
  }

  const mobile = normalizeMobile(phone);
  let response;
  try {
    response = await axios.post(
      "https://control.msg91.com/api/v5/otp",
      {},
      {
        params: { template_id: templateId, mobile, otp },
        headers: { authkey: authKey, "Content-Type": "application/json" },
        timeout: 10000,
      }
    );
  } catch (error) {
    console.error("MSG91 OTP delivery failed:", error.message);
    throw new Error("MSG91 could not send the verification code");
  }
  if (response.data?.type === "error" || response.data?.status === false) {
    throw new Error("MSG91 could not send the verification code");
  }
  return response.data;
};
