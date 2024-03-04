import { describe, test, expect } from '@jest/globals';
import { NotificationConverter } from '../src/services/converters/notification.converter';

describe('Notification Converter', () => {
  const converter = new NotificationConverter();
  test('convert accurately capture complete notification', async () => {
    const result = converter.convert({
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
    });

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
    const result = converter.convert({
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
    });

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
      return converter.convert({
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
      });
    }).rejects.toThrow('Unsupported event type');
  });

  test('fails if amount value is in the wrong format', async () => {
    await expect(async () => {
      return converter.convert({
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
      });
    }).rejects.toThrow('Invalid amount format');
  });
});
