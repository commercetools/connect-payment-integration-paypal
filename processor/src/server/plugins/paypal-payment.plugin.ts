import { FastifyInstance } from 'fastify';
import { paymentSDK } from '../../payment-sdk';
import { paymentRoutes } from '../../routes/paypal-payment.route';
import { app } from '../app';

export default async function (server: FastifyInstance) {
  await server.register(paymentRoutes, {
    sessionHeaderAuthHook: paymentSDK.sessionHeaderAuthHookFn,
    paymentService: app.services.paymentService,
    signatureAuthHook: app.hooks.signatureAuthHook,
  });
}
