/**
 * Shared number formatting utilities for VIVO Battle.
 *
 * Rules:
 *  - CR / Bs  → Venezuelan locale: 1.250,50  (dot = thousands, comma = decimal)
 *  - USD ($)  → US locale:         1,250.50  (comma = thousands, dot = decimal)
 */

/** Format Wallet Credits (WCR) — no decimals, dot as thousands separator */
export function fmtWCR(value: number): string {
  const intPart = Math.floor(value).toString();
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return formatted + " WCR";
}

/** Format Battle Credits (BCR) — no decimals, dot as thousands separator */
export function fmtBCR(value: number): string {
  const intPart = Math.floor(value).toString();
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return formatted + " BCR";
}

/** Format Bolívares — 2 decimal places, dot as thousands, comma as decimal */
export function fmtBs(value: number): string {
  return value.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " Bs";
}

/** Format US Dollars — 2 decimal places, US locale */
export function fmtUSD(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Convert Credits → USD
 * Convention: 100 CR = 1 USD
 */
export function crToUsd(credits: number): number {
  return credits / 100;
}

/**
 * Convert Credits → Bolívares
 * @param credits  Number of credits
 * @param bcvRate  BCV rate: Bs per 1 USD
 */
export function crToBs(credits: number, bcvRate: number): number {
  return crToUsd(credits) * bcvRate;
}

/**
 * Convert Bolívares → USD using BCV rate
 * @param bs       Amount in Bolívares
 * @param bcvRate  BCV rate: Bs per 1 USD
 */
export function bsToUsd(bs: number, bcvRate: number): number {
  return bcvRate > 0 ? bs / bcvRate : 0;
}
