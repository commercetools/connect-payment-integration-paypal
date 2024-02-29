import { paymentSDK } from '../payment-sdk';
import { PaypalPaymentService } from '../services/paypal-payment.service';

const paymentService = new PaypalPaymentService({
  ctCartService: paymentSDK.ctCartService,
  ctPaymentService: paymentSDK.ctPaymentService,
});

export const app = {
  services: {
    paymentService,
  },
};
