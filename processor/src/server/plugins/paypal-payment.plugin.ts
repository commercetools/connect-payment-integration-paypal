import { FastifyInstance } from 'fastify';
import { paymentSDK } from '../../payment-sdk';
import { paymentRoutes } from '../../routes/paypal-payment.route';
import { PaypalPaymentService } from '../../services/paypal-payment.service';

export default async function (server: FastifyInstance) {
  const paypalPaymentService = new PaypalPaymentService({
    ctCartService: paymentSDK.ctCartService,
    ctPaymentService: paymentSDK.ctPaymentService,
  });

  await server.register(paymentRoutes, {
    paymentService: paypalPaymentService,
    sessionAuthHook: paymentSDK.sessionAuthHookFn,
  });
}
