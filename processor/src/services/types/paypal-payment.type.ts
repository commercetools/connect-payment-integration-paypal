import { CaptureOrderRequestDTO, PaymentOutcome } from '../../dtos/paypal-payment.dto';

export type OrderConfirmation = {
  data: CaptureOrderRequestDTO & { orderId: string };
};

export type PaypalPaymentProviderResponse = {
  resultCode: PaymentOutcome;
  pspReference: string;
  paymentMethodType: string;
};
