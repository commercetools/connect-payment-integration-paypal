import { PaymentConfirmRequestSchemaDTO, PaymentOutcome, PaymentRequestSchemaDTO } from '../../dtos/paypal-payment.dto';

export type CreatePayment = {
  data: PaymentRequestSchemaDTO;
};

export type ConfirmPayment = {
  data: PaymentConfirmRequestSchemaDTO;
};

export type CreatePaymentRequest = {
  data: PaymentRequestSchemaDTO;
};

export type PaypalPaymentProviderResponse = {
  resultCode: PaymentOutcome;
  pspReference: string;
  paymentMethodType: string;
};
