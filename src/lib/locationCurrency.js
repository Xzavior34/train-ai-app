/**
 * Location-based dynamic currency detection.
 * Automatically resolves the user's local currency, symbol, and preferred payment provider
 * based on their browser timezone and system locale without displaying manual currency buttons.
 *
 * Supported primary currencies:
 * - Nigeria: NGN (₦) -> Paystack
 * - United Kingdom: GBP (£) -> Stripe
 * - Eurozone: EUR (€) -> Stripe
 * - United States & International: USD ($) -> Stripe
 * - Ghana: GHS (GH₵) -> Paystack
 * - Kenya: KES (KSh) -> Paystack
 * - South Africa: ZAR (R) -> Paystack
 */

const CURRENCY_CONFIG = {
  NGN: {
    currency: "NGN",
    symbol: "₦",
    name: "Nigerian Naira",
    provider: "paystack",
  },
  GBP: {
    currency: "GBP",
    symbol: "£",
    name: "British Pound",
    provider: "stripe",
  },
  EUR: {
    currency: "EUR",
    symbol: "€",
    name: "Euro",
    provider: "stripe",
  },
  USD: {
    currency: "USD",
    symbol: "$",
    name: "US Dollar",
    provider: "stripe",
  },
  GHS: {
    currency: "GHS",
    symbol: "GH₵",
    name: "Ghanaian Cedi",
    provider: "paystack",
  },
  KES: {
    currency: "KES",
    symbol: "KSh",
    name: "Kenyan Shilling",
    provider: "paystack",
  },
  ZAR: {
    currency: "ZAR",
    symbol: "R",
    name: "South African Rand",
    provider: "paystack",
  },
};

const EUROZONE_TIMEZONES = new Set([
  "Europe/Paris", "Europe/Berlin", "Europe/Rome", "Europe/Madrid",
  "Europe/Amsterdam", "Europe/Brussels", "Europe/Vienna", "Europe/Dublin",
  "Europe/Lisbon", "Europe/Helsinki", "Europe/Athens", "Europe/Vienna",
  "Europe/Luxembourg", "Europe/Monaco", "Europe/Malta", "Europe/Nicosia",
  "Europe/Ljubljana", "Europe/Bratislava", "Europe/Tallinn", "Europe/Riga",
  "Europe/Vilnius",
]);

const UK_TIMEZONES = new Set([
  "Europe/London", "Europe/Belfast", "Europe/Jersey", "Europe/Guernsey",
  "Europe/Isle_of_Man", "GMT", "BST",
]);

/**
 * Detects the user's currency based on their browser timezone and locale.
 *
 * @returns {{ currency: string, symbol: string, name: string, provider: "paystack"|"stripe" }}
 */
export function getUserLocationCurrency() {
  let timeZone = "";
  let locale = "";

  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    // fallback
  }

  try {
    locale = (typeof navigator !== "undefined" ? (navigator.language || (navigator.languages && navigator.languages[0])) : "") || "";
  } catch {
    // fallback
  }

  const tz = timeZone.trim();
  const loc = locale.toLowerCase().trim();

  // 1. Nigeria Check
  if (
    tz === "Africa/Lagos" ||
    tz.startsWith("Africa/Lagos") ||
    tz === "Africa/Porto-Novo" ||
    loc.endsWith("-ng") ||
    loc === "en-ng" ||
    loc === "yo-ng" ||
    loc === "ha-ng" ||
    loc === "ig-ng"
  ) {
    return CURRENCY_CONFIG.NGN;
  }

  // 2. United Kingdom Check
  if (
    UK_TIMEZONES.has(tz) ||
    tz === "Europe/London" ||
    loc.endsWith("-gb") ||
    loc === "en-gb" ||
    loc === "en-uk" ||
    loc === "cy-gb" ||
    loc === "gd-gb"
  ) {
    return CURRENCY_CONFIG.GBP;
  }

  // 3. Eurozone Check
  if (
    EUROZONE_TIMEZONES.has(tz) ||
    (tz.startsWith("Europe/") && !UK_TIMEZONES.has(tz)) ||
    loc.endsWith("-fr") || loc.endsWith("-de") || loc.endsWith("-it") ||
    loc.endsWith("-es") || loc.endsWith("-nl") || loc.endsWith("-pt") ||
    loc.endsWith("-ie") || loc.endsWith("-fi") || loc.endsWith("-gr") ||
    loc.endsWith("-be") || loc.endsWith("-at")
  ) {
    return CURRENCY_CONFIG.EUR;
  }

  // 4. Ghana Check
  if (tz === "Africa/Accra" || loc.endsWith("-gh")) {
    return CURRENCY_CONFIG.GHS;
  }

  // 5. Kenya Check
  if (tz === "Africa/Nairobi" || loc.endsWith("-ke")) {
    return CURRENCY_CONFIG.KES;
  }

  // 6. South Africa Check
  if (tz === "Africa/Johannesburg" || loc.endsWith("-za")) {
    return CURRENCY_CONFIG.ZAR;
  }

  // 7. Default to USD (US, Canada, and all other international regions)
  return CURRENCY_CONFIG.USD;
}

/**
 * Format a numeric amount with the user's location currency symbol.
 *
 * @param {number} amount
 * @param {string} [overrideCurrency]
 * @returns {string}
 */
export function formatCurrencyAmount(amount, overrideCurrency = null) {
  const currencyInfo = overrideCurrency ? (CURRENCY_CONFIG[overrideCurrency] || CURRENCY_CONFIG.USD) : getUserLocationCurrency();
  const num = Number(amount) || 0;

  if (currencyInfo.currency === "NGN") {
    return `${currencyInfo.symbol}${num.toLocaleString()}`;
  }
  return `${currencyInfo.symbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
