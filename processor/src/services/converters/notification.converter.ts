import { ErrorGeneral, TransactionData, UpdatePayment } from '@commercetools/connect-payments-sdk';
import { TransactionStates, TransactionTypes, NotificationEventType } from '../types/paypal-payment.type';
import { Money } from '@commercetools/platform-sdk';
import { NotificationPayloadDTO, NotificationResourceDTO } from '../../dtos/paypal-payment.dto';

export class NotificationConverter {
  public convert(item: NotificationPayloadDTO): UpdatePayment {
    return {
      id: item.resource.invoice_id,
      transaction: this.populateTransaction(item),
    };
  }

  private populateTransaction(item: NotificationPayloadDTO): TransactionData {
    switch (item.event_type) {
      case NotificationEventType.PAYMENT_CAPTURE_COMPLETED:
        return {
          type: TransactionTypes.CHARGE,
          state: TransactionStates.SUCCESS,
          amount: this.convertAmount(item.resource),
          interactionId: item.resource.id,
        };
      case NotificationEventType.PAYMENT_CAPTURE_DECLINED:
        return {
          type: TransactionTypes.CHARGE,
          state: TransactionStates.FAILURE,
          amount: this.convertAmount(item.resource),
          interactionId: item.resource.id,
        };
      case NotificationEventType.PAYMENT_CAPTURE_REFUNDED:
        return {
          type: TransactionTypes.REFUND,
          state: TransactionStates.SUCCESS,
          amount: this.convertAmount(item.resource),
          interactionId: item.resource.id,
        };
      case NotificationEventType.PAYMENT_CAPTURE_REVERSED:
        return {
          type: TransactionTypes.REFUND,
          state: TransactionStates.SUCCESS,
          amount: this.convertAmount(item.resource),
          interactionId: item.resource.id,
        };
      default:
        throw new ErrorGeneral('Unsupported event type', {
          fields: {
            event_type: item.event_type,
            payment_id: item.resource.invoice_id,
          },
        });
    }
  }

  private convertAmount(item: NotificationResourceDTO): Money {
    return {
      centAmount: this.parseStringAmountToCentAmount(item.amount.value),
      currencyCode: item.amount.currency_code,
    };
  }

  private parseStringAmountToCentAmount(amount: string): number {
    const [units, cents] = amount.split('.').map((part) => parseInt(part, 10));
    if (isNaN(units) || isNaN(cents)) {
      throw new ErrorGeneral('Invalid amount format', {
        fields: {
          amount: amount,
        },
      });
    }

    return units * 100 + cents;
  }
}
