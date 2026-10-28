const { pct } = require("./money");

// Indian GST. Intra-state supply splits tax into CGST + SGST; inter-state
// supply is IGST. When the tax is an odd number of paise, the extra paisa
// goes to CGST so the two halves always add back to the total.

const splitTax = (tax, interState) => {
  if (interState) return { cgst: 0, sgst: 0, igst: tax };
  const sgst = Math.floor(tax / 2);
  return { cgst: tax - sgst, sgst, igst: 0 };
};

// GST-inclusive price -> taxable value + tax
const splitInclusive = (gross, ratePct, interState = false) => {
  const taxable = Math.round((gross * 100) / (100 + ratePct));
  const tax = gross - taxable;
  return { gross, taxable, tax, ...splitTax(tax, interState) };
};

// Taxable value -> taxable value + tax on top
const addGst = (taxable, ratePct, interState = false) => {
  const tax = pct(taxable, ratePct);
  return { gross: taxable + tax, taxable, tax, ...splitTax(tax, interState) };
};

// Tax on an amount at a rate (exclusive)
const gstOf = (amount, ratePct = 18) => pct(amount, ratePct);

// Tax contained in a GST-inclusive amount
const gstInside = (gross, ratePct = 18) => gross - Math.round((gross * 100) / (100 + ratePct));

// Place of supply is the customer's state when known, else the store's
const isInterState = (storeStateCode, customerStateCode) =>
  Boolean(customerStateCode && storeStateCode && String(customerStateCode) !== String(storeStateCode));

module.exports = { splitTax, splitInclusive, addGst, gstOf, gstInside, isInterState };
