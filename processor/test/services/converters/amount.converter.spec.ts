import { describe, test, expect } from '@jest/globals';
import { convertCoCoAmountToPayPalAmount } from '../../../src/services/converters/amount.converter';
import { Money } from '@commercetools/connect-payments-sdk';

describe('amount.converter', () => {
  test('should convert CoCo centAmount of 1099 EUR to "10.99" to send to PayPal', async () => {
    const inputMoney: Money = {
      centAmount: 1099,
      currencyCode: 'EUR',
    };
    const inputFractionDigits = 2;

    const result = convertCoCoAmountToPayPalAmount(inputMoney, inputFractionDigits);

    const expected = '10.99';

    expect(result).toEqual(expected);
  });

  test('should convert CoCo centAmount of 12345 EUR to "123.45" to send to PayPal', async () => {
    const inputMoney: Money = {
      centAmount: 12345,
      currencyCode: 'EUR',
    };
    const inputFractionDigits = 2;

    const result = convertCoCoAmountToPayPalAmount(inputMoney, inputFractionDigits);

    const expected = '123.45';

    expect(result).toEqual(expected);
  });

  test('should convert CoCo centAmount of 1948 USD to "19.48" to send to PayPal', async () => {
    const inputMoney: Money = {
      centAmount: 1948,
      currencyCode: 'USD',
    };
    const inputFractionDigits = 2;

    const result = convertCoCoAmountToPayPalAmount(inputMoney, inputFractionDigits);

    const expected = '19.48';

    expect(result).toEqual(expected);
  });

  test('should convert CoCo centAmount of 100 CLP to "100" to send to PayPal', async () => {
    const inputMoney: Money = {
      centAmount: 100,
      currencyCode: 'CLP',
    };
    const inputFractionDigits = 0;

    const result = convertCoCoAmountToPayPalAmount(inputMoney, inputFractionDigits);

    const expected = '100';

    expect(result).toEqual(expected);
  });

  test('should convert CoCo centAmount of 100 BHD to "0.1" to send to PayPal', async () => {
    const inputMoney: Money = {
      centAmount: 100,
      currencyCode: 'BHD',
    };
    const inputFractionDigits = 3;

    const result = convertCoCoAmountToPayPalAmount(inputMoney, inputFractionDigits);

    const expected = '0.1';

    expect(result).toEqual(expected);
  });

  test('should convert CoCo centAmount of 1 BHD to "0.001" to send to PayPal', async () => {
    const inputMoney: Money = {
      centAmount: 1,
      currencyCode: 'BHD',
    };
    const inputFractionDigits = 3;

    const result = convertCoCoAmountToPayPalAmount(inputMoney, inputFractionDigits);

    const expected = '0.001';

    expect(result).toEqual(expected);
  });
});
