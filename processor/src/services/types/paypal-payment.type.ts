import { PaymentRequestSchemaDTO } from '../../dtos/paypal-payment.dto';

export type CreatePayment = {
  data: PaymentRequestSchemaDTO;
};
