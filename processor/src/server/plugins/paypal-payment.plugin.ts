import { FastifyInstance } from 'fastify';
import { paymentSDK } from '../../payment-sdk';
import { paymentRoutes } from '../../routes/paypal-payment.route';
import { app } from '../app';

export default async function (server: FastifyInstance) {
  await server.register(paymentRoutes, {
    paymentService: app.services.paymentService,
    sessionAuthHook: paymentSDK.sessionAuthHookFn,
  });
}
