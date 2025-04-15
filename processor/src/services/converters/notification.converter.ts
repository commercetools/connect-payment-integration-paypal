import { ErrorGeneral, TransactionData, UpdatePayment } from '@commercetools/connect-payments-sdk';
import { TransactionStates, TransactionTypes, NotificationEventType } from '../types/paypal-payment.type';
import { NotificationPayloadDTO } from '../../dtos/paypal-payment.dto';
import { convertPayPalAmountToCoCoAmount } from './amount.converter';

export class NotificationConverter {
  public convert(item: NotificationPayloadDTO, fractionDigit: number): UpdatePayment {
    return {
      id: item.resource.invoice_id,
      transaction: this.populateTransaction(item, fractionDigit),
    };
  }

  private populateTransaction(item: NotificationPayloadDTO, fractionDigit: number): TransactionData {
    switch (item.event_type) {
      case NotificationEventType.PAYMENT_CAPTURE_COMPLETED:
        return {
          type: TransactionTypes.CHARGE,
          state: TransactionStates.SUCCESS,
          amount: convertPayPalAmountToCoCoAmount(item.resource.amount, fractionDigit),
          interactionId: item.resource.id,
        };
      case NotificationEventType.PAYMENT_CAPTURE_DECLINED:
        return {
          type: TransactionTypes.CHARGE,
          state: TransactionStates.FAILURE,
          amount: convertPayPalAmountToCoCoAmount(item.resource.amount, fractionDigit),
          interactionId: item.resource.id,
        };
      case NotificationEventType.PAYMENT_CAPTURE_REFUNDED:
        return {
          type: TransactionTypes.REFUND,
          state: TransactionStates.SUCCESS,
          amount: convertPayPalAmountToCoCoAmount(item.resource.amount, fractionDigit),
          interactionId: item.resource.id,
        };
      case NotificationEventType.PAYMENT_CAPTURE_REVERSED:
        return {
          type: TransactionTypes.REFUND,
          state: TransactionStates.SUCCESS,
          amount: convertPayPalAmountToCoCoAmount(item.resource.amount, fractionDigit),
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
}
