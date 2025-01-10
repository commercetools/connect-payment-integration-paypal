import {
  ErrorGeneral,
  TransactionData,
  UpdatePayment,
  Money,
  CurrencyConverters,
} from '@commercetools/connect-payments-sdk';
import { TransactionStates, TransactionTypes, NotificationEventType } from '../types/paypal-payment.type';
import { NotificationPayloadDTO, NotificationResourceDTO } from '../../dtos/paypal-payment.dto';

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
          amount: this.convertPayPalAmountToCoCoAmount(item.resource, fractionDigit),
          interactionId: item.resource.id,
        };
      case NotificationEventType.PAYMENT_CAPTURE_DECLINED:
        return {
          type: TransactionTypes.CHARGE,
          state: TransactionStates.FAILURE,
          amount: this.convertPayPalAmountToCoCoAmount(item.resource, fractionDigit),
          interactionId: item.resource.id,
        };
      case NotificationEventType.PAYMENT_CAPTURE_REFUNDED:
        return {
          type: TransactionTypes.REFUND,
          state: TransactionStates.SUCCESS,
          amount: this.convertPayPalAmountToCoCoAmount(item.resource, fractionDigit),
          interactionId: item.resource.id,
        };
      case NotificationEventType.PAYMENT_CAPTURE_REVERSED:
        return {
          type: TransactionTypes.REFUND,
          state: TransactionStates.SUCCESS,
          amount: this.convertPayPalAmountToCoCoAmount(item.resource, fractionDigit),
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

  private convertPayPalAmountToCoCoAmount(item: NotificationResourceDTO, fractionDigit: number): Money {
    return {
      centAmount: this.parseStringAmountToCentAmount(item.amount.value, fractionDigit),
      currencyCode: item.amount.currency_code,
    };
  }

  private parseAndValidateNumberInteger(value: string): number {
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
  }

  private parseStringAmountToCentAmount(amount: string, fractionDigit: number): number {
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

      const unitsAsInteger = this.parseAndValidateNumberInteger(amount);
      return unitsAsInteger;
    }

    const unitsAsString = amountSplittedBetweenUnitsAndCents[0];
    const centsAsString = amountSplittedBetweenUnitsAndCents[1];

    const unitsAsInteger = this.parseAndValidateNumberInteger(unitsAsString);
    const centsAsInteger = this.parseAndValidateNumberInteger(centsAsString);
    const unitsAsIntegerConverted = CurrencyConverters.convert(unitsAsInteger, fractionDigit);

    const cocoCentAmount = unitsAsIntegerConverted + centsAsInteger;
    return cocoCentAmount;
  }
}
