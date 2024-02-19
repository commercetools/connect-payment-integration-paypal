import { FastifyInstance } from 'fastify';
import { paymentSDK } from '../../payment-sdk';
import { operationsRoute } from '../../routes/operation.route';
import { DefaultOperationService } from '../../services/operation.service';
import { PaypalOperationProcessor } from '../../services/processors/paypal-operation.processor';

export default async function (server: FastifyInstance) {
  const paymentProcessor = new PaypalOperationProcessor();

  const operationService = new DefaultOperationService({
    ctCartService: paymentSDK.ctCartService,
    ctPaymentService: paymentSDK.ctPaymentService,
    operationProcessor: paymentProcessor,
  });

  await server.register(operationsRoute, {
    prefix: '/operations',
    operationService: operationService,
    jwtAuthHook: paymentSDK.jwtAuthHookFn,
    oauth2AuthHook: paymentSDK.oauth2AuthHookFn,
    sessionAuthHook: paymentSDK.sessionAuthHookFn,
    authorizationHook: paymentSDK.authorityAuthorizationHookFn,
  });
}
