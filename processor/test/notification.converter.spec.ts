import { describe, test, expect } from '@jest/globals';
import { NotificationConverter } from '../src/services/converters/notification.converter';

describe('Notification Converter', () => {
  const converter = new NotificationConverter();
  test('convert accurately capture complete notification', async () => {
    const result = converter.convert(
      {
        id: 'WH-43D18642RU',
        resource_type: 'capture',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: '3X766405',
          status: 'COMPLETED',
          invoice_id: '423bd1e0-313e',
          amount: {
            currency_code: 'EUR',
            value: '300.35',
          },
        },
      },
      2,
    );

    expect(result).toStrictEqual({
      id: '423bd1e0-313e',
      transaction: {
        amount: {
          centAmount: 30035,
          currencyCode: 'EUR',
        },
        interactionId: '3X766405',
        state: 'Success',
        type: 'Charge',
      },
    });
  });

  test('convert accurately refund complete notification', async () => {
    const result = converter.convert(
      {
        id: 'WH-43D18642RU',
        resource_type: 'refund',
        event_type: 'PAYMENT.CAPTURE.REFUNDED',
        resource: {
          id: '3X766405',
          status: 'COMPLETED',
          invoice_id: '423bd1e0-313e',
          amount: {
            currency_code: 'EUR',
            value: '300.35',
          },
        },
      },
      2,
    );

    expect(result).toStrictEqual({
      id: '423bd1e0-313e',
      transaction: {
        amount: {
          centAmount: 30035,
          currencyCode: 'EUR',
        },
        interactionId: '3X766405',
        state: 'Success',
        type: 'Refund',
      },
    });
  });

  test('fails if event type is not supported', async () => {
    await expect(async () => {
      return converter.convert(
        {
          id: 'WH-43D18642RU',
          resource_type: 'refund',
          event_type: 'PAYMENT.CAPTURE.NOT_SUPPORTED',
          resource: {
            id: '3X766405',
            status: 'COMPLETED',
            invoice_id: '423bd1e0-313e',
            amount: {
              currency_code: 'EUR',
              value: '300.35',
            },
          },
        },
        2,
      );
    }).rejects.toThrow('Unsupported event type');
  });

  test('fails if amount value is in the wrong format', async () => {
    await expect(async () => {
      return converter.convert(
        {
          id: 'WH-43D18642RU',
          resource_type: 'refund',
          event_type: 'PAYMENT.CAPTURE.REFUNDED',
          resource: {
            id: '3X766405',
            status: 'COMPLETED',
            invoice_id: '423bd1e0-313e',
            amount: {
              currency_code: 'EUR',
              value: '300',
            },
          },
        },
        2,
      );
    }).rejects.toThrow('Invalid amount format');
  });

  test('fails if amount value is in the wrong format when the fractionDigit is 0', async () => {
    await expect(async () => {
      return converter.convert(
        {
          id: 'WH-43D18642RU',
          resource_type: 'refund',
          event_type: 'PAYMENT.CAPTURE.REFUNDED',
          resource: {
            id: '3X766405',
            status: 'COMPLETED',
            invoice_id: '423bd1e0-313e',
            amount: {
              currency_code: 'CLP',
              value: '300.11',
            },
          },
        },
        0,
      );
    }).rejects.toThrow(
      'Fraction digit is 0 but the given amount has a "." character in it, indicating a decimal numbers',
    );
  });

  test('should convert with currencies with 0 fraction digits', async () => {
    const result = converter.convert(
      {
        id: 'WH-43D18642RU',
        resource_type: 'capture',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: '3X766405',
          status: 'COMPLETED',
          invoice_id: '423bd1e0-313e',
          amount: {
            currency_code: 'CLP',
            value: '300',
          },
        },
      },
      0,
    );

    expect(result).toStrictEqual({
      id: '423bd1e0-313e',
      transaction: {
        amount: {
          centAmount: 300,
          currencyCode: 'CLP',
        },
        interactionId: '3X766405',
        state: 'Success',
        type: 'Charge',
      },
    });
  });

  test('should convert with currencies with 2 fraction digits', async () => {
    const result = converter.convert(
      {
        id: 'WH-43D18642RU',
        resource_type: 'capture',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: '3X766405',
          status: 'COMPLETED',
          invoice_id: '423bd1e0-313e',
          amount: {
            currency_code: 'USD',
            value: '300.21',
          },
        },
      },
      2,
    );

    expect(result).toStrictEqual({
      id: '423bd1e0-313e',
      transaction: {
        amount: {
          centAmount: 30021,
          currencyCode: 'USD',
        },
        interactionId: '3X766405',
        state: 'Success',
        type: 'Charge',
      },
    });
  });

  test('should convert with currencies with 3 fraction digits', async () => {
    const result = converter.convert(
      {
        id: 'WH-43D18642RU',
        resource_type: 'capture',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: '3X766405',
          status: 'COMPLETED',
          invoice_id: '423bd1e0-313e',
          amount: {
            currency_code: 'JOD',
            value: '499.999',
          },
        },
      },
      3,
    );

    expect(result).toStrictEqual({
      id: '423bd1e0-313e',
      transaction: {
        amount: {
          centAmount: 499999,
          currencyCode: 'JOD',
        },
        interactionId: '3X766405',
        state: 'Success',
        type: 'Charge',
      },
    });
  });

  test('should convert with currencies with 4 fraction digits', async () => {
    const result = converter.convert(
      {
        id: 'WH-43D18642RU',
        resource_type: 'capture',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: '3X766405',
          status: 'COMPLETED',
          invoice_id: '423bd1e0-313e',
          amount: {
            currency_code: 'UYW',
            value: '49.9999',
          },
        },
      },
      4,
    );

    expect(result).toStrictEqual({
      id: '423bd1e0-313e',
      transaction: {
        amount: {
          centAmount: 499999,
          currencyCode: 'UYW',
        },
        interactionId: '3X766405',
        state: 'Success',
        type: 'Charge',
      },
    });
  });
});
