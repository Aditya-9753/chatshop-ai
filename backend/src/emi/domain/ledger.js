const { DomainError } = require("./emi");

// Chart of accounts. Assets 1xxx, liabilities 2xxx, income 4xxx, expenses 5xxx.
const ACC = {
  CASH: "1000",
  BANK: "1010",
  CUSTOMER_RECEIVABLE: "1100",
  GATEWAY_RECEIVABLE: "1200",
  EMI_PRINCIPAL: "1300",
  EMI_INTEREST: "1310",
  LATE_FEE_RECEIVABLE: "1320",
  NBFC_RECEIVABLE: "1400",
  INPUT_GST: "1600",
  OUTPUT_CGST: "2100",
  OUTPUT_SGST: "2110",
  OUTPUT_IGST: "2120",
  UNEARNED_INTEREST: "2200",
  CUSTOMER_ADVANCE: "2300",
  SALES: "4000",
  INTEREST_INCOME: "4100",
  LATE_FEE_INCOME: "4200",
  FORECLOSURE_INCOME: "4300",
  MDR_EXPENSE: "5100",
  NBFC_SUBVENTION: "5200",
  WAIVERS: "5300",
};

const ACCOUNT_NAMES = {
  1000: "Cash in hand",
  1010: "Bank",
  1100: "Customer receivable",
  1200: "Card/UPI settlement receivable",
  1300: "EMI principal receivable",
  1310: "EMI interest receivable",
  1320: "Late fee receivable",
  1400: "NBFC receivable",
  1600: "Input GST (ITC)",
  2100: "Output CGST",
  2110: "Output SGST",
  2120: "Output IGST",
  2200: "Unearned interest",
  2300: "Customer advance",
  4000: "Sales",
  4100: "Interest income",
  4200: "Late fee income",
  4300: "Foreclosure charges",
  5100: "Card/UPI fees (MDR)",
  5200: "NBFC subvention",
  5300: "Waivers",
};

// Receivables that must be zero once every rupee owed has come in
const RECEIVABLE_ACCOUNTS = [ACC.CUSTOMER_RECEIVABLE, ACC.GATEWAY_RECEIVABLE, ACC.EMI_PRINCIPAL, ACC.EMI_INTEREST, ACC.LATE_FEE_RECEIVABLE, ACC.NBFC_RECEIVABLE];

// Where money received by each method lands
const accountForMethod = (method) => (method === "CASH" ? ACC.CASH : method === "BANK" ? ACC.BANK : ACC.GATEWAY_RECEIVABLE);

const dr = (account, amount) => ({ account, dr: amount, cr: 0 });
const cr = (account, amount) => ({ account, dr: 0, cr: amount });

// Credit lines for output GST (zero lines dropped)
const gstCredits = ({ cgst = 0, sgst = 0, igst = 0 }) =>
  [cr(ACC.OUTPUT_CGST, cgst), cr(ACC.OUTPUT_SGST, sgst), cr(ACC.OUTPUT_IGST, igst)].filter((l) => l.cr);

// Throws unless Dr = Cr and every line is a non-negative whole number of paise
const assertBalanced = (journal) => {
  let debit = 0;
  let credit = 0;
  for (const line of journal.lines) {
    if (!ACCOUNT_NAMES[line.account]) throw new DomainError("BAD_ACCOUNT", `Account ${line.account} nahi hai`);
    for (const v of [line.dr, line.cr]) {
      if (!Number.isInteger(v) || v < 0) throw new DomainError("BAD_AMOUNT", `${journal.event}: amount ${v} paise me integer nahi hai`);
    }
    debit += line.dr;
    credit += line.cr;
  }
  if (debit !== credit) {
    throw new DomainError("UNBALANCED", `${journal.event}: Dr ${debit} ≠ Cr ${credit}`);
  }
  return journal;
};

// Build a journal, dropping zero lines, and check it balances
const journal = (event, lines, extra = {}) =>
  assertBalanced({ event, ...extra, lines: lines.filter((l) => l.dr || l.cr) });

// Mirror image of a journal, used to cancel it
const reverse = (entry, event = `${entry.event}_REVERSED`) =>
  journal(event, entry.lines.map((l) => ({ account: l.account, dr: l.cr, cr: l.dr })));

// Balance per account (Dr − Cr) across journals, plus overall totals
const trialBalance = (journals) => {
  const byAccount = {};
  for (const entry of journals) {
    for (const line of entry.lines) {
      const row = (byAccount[line.account] ||= { account: line.account, name: ACCOUNT_NAMES[line.account], dr: 0, cr: 0 });
      row.dr += line.dr;
      row.cr += line.cr;
    }
  }
  const rows = Object.values(byAccount)
    .map((row) => ({ ...row, balance: row.dr - row.cr }))
    .sort((a, b) => a.account.localeCompare(b.account));
  const totals = rows.reduce((t, row) => ({ dr: t.dr + row.dr, cr: t.cr + row.cr }), { dr: 0, cr: 0 });
  return { rows, totals, balanced: totals.dr === totals.cr };
};

const balanceOf = (tb, account) => tb.rows.find((r) => r.account === account)?.balance || 0;

module.exports = {
  ACC,
  ACCOUNT_NAMES,
  RECEIVABLE_ACCOUNTS,
  accountForMethod,
  dr,
  cr,
  gstCredits,
  assertBalanced,
  journal,
  reverse,
  trialBalance,
  balanceOf,
};
