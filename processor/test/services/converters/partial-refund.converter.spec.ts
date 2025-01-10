import { describe, test, expect } from '@jest/globals';
import { RefundPaymentRequest } from '../../../src/services/types/operation.type';
import {
  PartialRefundConverter,
  PartialRefundPayload,
} from '../../../src/services/converters/partial-refund.converter';
import { Payment } from '@commercetools/connect-payments-sdk';

describe('partial-refund.converter', () => {
  const partialRefundConverter = new PartialRefundConverter();

  test('should convert partial refund request with centAmount of 1099 EUR to "10.99" to send to PayPal', async () => {
    const input: RefundPaymentRequest = {
      amount: {
        centAmount: 1099,
        currencyCode: 'EUR',
      },
      payment: {
        amountPlanned: {
          centAmount: 1099,
          currencyCode: 'EUR',
          fractionDigits: 2,
          type: 'centPrecision',
        },
      } as Payment,
    };

    const result = partialRefundConverter.convert(input);

    const expected: PartialRefundPayload = {
      amount: {
        currency_code: 'EUR',
        value: '10.99',
      },
    };

    expect(result).toEqual(expected);
  });

  test('should convert partial refund request with centAmount of 10 EUR to "0.1" to send to PayPal', async () => {
    const input: RefundPaymentRequest = {
      amount: {
        centAmount: 10,
        currencyCode: 'EUR',
      },
      payment: {
        amountPlanned: {
          centAmount: 10,
          currencyCode: 'EUR',
          fractionDigits: 2,
          type: 'centPrecision',
        },
      } as Payment,
    };

    const result = partialRefundConverter.convert(input);

    const expected: PartialRefundPayload = {
      amount: {
        currency_code: 'EUR',
        value: '0.1',
      },
    };

    expect(result).toEqual(expected);
  });

  test('should convert partial refund request with centAmount of 123 CLP to "123" to send to PayPal', async () => {
    const input: RefundPaymentRequest = {
      amount: {
        centAmount: 123,
        currencyCode: 'CLP',
      },
      payment: {
        amountPlanned: {
          centAmount: 123,
          currencyCode: 'CLP',
          fractionDigits: 0,
          type: 'centPrecision',
        },
      } as Payment,
    };

    const result = partialRefundConverter.convert(input);

    const expected: PartialRefundPayload = {
      amount: {
        currency_code: 'CLP',
        value: '123',
      },
    };

    expect(result).toEqual(expected);
  });
});
