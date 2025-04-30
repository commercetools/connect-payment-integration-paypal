import { Money, CurrencyConverters, ErrorGeneral } from '@commercetools/connect-payments-sdk';
import { Amount } from '../../clients/types/paypal.client.type';

export const convertCoCoAmountToPayPalAmount = (amountToConvert: Money, fractionDigits: number): string => {
  // Since we need to get the non-cent-amount representation we make the fractionDigits negative to move the decimal to the left.
  const negativeFractionDigits = -fractionDigits;
  const amount = CurrencyConverters.convert(amountToConvert.centAmount, negativeFractionDigits);

  return amount.toString();
};

export const convertPayPalAmountToCoCoAmount = (amount: Amount, fractionDigit: number): Money => {
  return {
    centAmount: parseStringAmountToCentAmount(amount.value, fractionDigit),
    currencyCode: amount.currency_code,
  };
};

export const parseAndValidateNumberInteger = (value: string): number => {
  const valueParsed = parseInt(value, 10);

  if (isNaN(valueParsed) || !Number.isInteger(valueParsed)) {
    throw new ErrorGeneral('Invalid amount format', {
      fields: {
        value,
        valueParsed,
      },
    });
  }

  return valueParsed;
};

export const parseStringAmountToCentAmount = (amount: string, fractionDigit: number): number => {
  const amountSplittedBetweenUnitsAndCents = amount.split('.', 2);

  // There are no cents when fractionDigit is 0 and thus no need to convert.
  if (fractionDigit === 0) {
    if (amountSplittedBetweenUnitsAndCents.length > 1) {
      throw new ErrorGeneral(
        'Fraction digit is 0 but the given amount has a "." character in it, indicating a decimal numbers',
        {
          fields: {
            amount,
            fractionDigit,
          },
        },
      );
    }

    const unitsAsInteger = parseAndValidateNumberInteger(amount);
    return unitsAsInteger;
  }

  const unitsAsString = amountSplittedBetweenUnitsAndCents[0];
  const centsAsString = amountSplittedBetweenUnitsAndCents[1];

  const unitsAsInteger = parseAndValidateNumberInteger(unitsAsString);
  const centsAsInteger = parseAndValidateNumberInteger(centsAsString);
  const unitsAsIntegerConverted = CurrencyConverters.convert(unitsAsInteger, fractionDigit);

  const cocoCentAmount = unitsAsIntegerConverted + centsAsInteger;
  return cocoCentAmount;
};
