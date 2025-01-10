import { Money, CurrencyConverters } from '@commercetools/connect-payments-sdk';

export const convertCoCoAmountToPayPalAmount = (amountToConvert: Money, fractionDigits: number): string => {
  // Since we need to get the non-cent-amount representation we make the fractionDigits negative to move the decimal to the left.
  const negativeFractionDigits = -fractionDigits;
  const amount = CurrencyConverters.convert(amountToConvert.centAmount, negativeFractionDigits);

  return amount.toString();
};
