/** COP amounts are integer centavos. Provider adapters must explicitly convert units. */
export type CopAmount = Readonly<{ currency: 'COP'; minor: number }>;

export function cop(minor: number): CopAmount {
  if (!Number.isSafeInteger(minor) || minor < 0) throw new Error('Invalid COP minor amount');
  return Object.freeze({ currency: 'COP', minor });
}

/** Unformatted decimal input only; UI owns locale normalization, never parseFloat. */
export function parseCop(input: string): CopAmount {
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(input)) throw new Error('Invalid COP decimal');
  const [whole, fraction = ''] = input.split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('COP amount too large');
  return cop(Number(minor));
}

export type TotalInput = Readonly<{
  subtotal: CopAmount; discount: CopAmount; tax: CopAmount; tip: CopAmount;
}>;

/** Pure arithmetic, not a tax policy or trusted browser quote. Server must recalculate. */
export function totalCop(input: TotalInput): CopAmount {
  for (const amount of Object.values(input)) {
    if (amount.currency !== 'COP') throw new Error('Currency mismatch');
    cop(amount.minor);
  }
  if (input.discount.minor > input.subtotal.minor) throw new Error('Discount exceeds subtotal');
  const total = BigInt(input.subtotal.minor) - BigInt(input.discount.minor)
    + BigInt(input.tax.minor) + BigInt(input.tip.minor);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('COP total too large');
  return cop(Number(total));
}

/** No OneJob fee is inherited. Explicit quoted basis points and fixed fee only. */
export function quotedFee(amount: CopAmount, basisPoints: number, fixed: CopAmount): CopAmount {
  cop(amount.minor); cop(fixed.minor);
  if (amount.currency !== 'COP' || fixed.currency !== 'COP') throw new Error('Currency mismatch');
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > 10000)
    throw new Error('Invalid basis points');
  // Round half up once, at the centavo boundary. Tax on fees is a separate quote component.
  const minor = (BigInt(amount.minor) * BigInt(basisPoints) + 5000n) / 10000n + BigInt(fixed.minor);
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('COP fee too large');
  return cop(Number(minor));
}
