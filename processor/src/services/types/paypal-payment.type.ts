import { OrderCaptureRequestSchemaDTO, PaymentOutcome } from '../../dtos/paypal-payment.dto';

export type OrderConfirmation = {
  data: OrderCaptureRequestSchemaDTO & { orderId: string };
};

export type PaypalPaymentProviderResponse = {
  resultCode: PaymentOutcome;
  pspReference: string;
  paymentMethodType: string;
};
