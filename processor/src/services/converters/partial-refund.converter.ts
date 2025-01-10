import { RefundPaymentRequest } from '../types/operation.type';
import { convertCoCoAmountToPayPalAmount } from './amount.converter';

export type PartialRefundPayload = {
  amount: {
    currency_code: string;
    value: string;
  };
};

export class PartialRefundConverter {
  public convert(request: RefundPaymentRequest): PartialRefundPayload {
    return {
      amount: {
        currency_code: request.amount.currencyCode,
        value: convertCoCoAmountToPayPalAmount(request.amount, request.payment.amountPlanned.fractionDigits),
      },
    };
  }
}
