import { SessionAuthenticationHook } from '@commercetools/connect-payments-sdk';
import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  PaymentConfirmRequestSchemaDTO,
  PaymentConfirmationRequestSchema,
  PaymentRequestSchema,
  PaymentRequestSchemaDTO,
  PaymentResponseSchema,
  PaymentResponseSchemaDTO,
} from '../dtos/paypal-payment.dto';
import { PaypalPaymentService } from '../services/paypal-payment.service';
import { PaymentIntentResponseSchemaDTO, PaymentIntentResponseSchema } from '../dtos/operations/payment-intents.dto';

type PaymentRoutesOptions = {
  paymentService: PaypalPaymentService;
  sessionAuthHook: SessionAuthenticationHook;
};

export const paymentRoutes = async (fastify: FastifyInstance, opts: FastifyPluginOptions & PaymentRoutesOptions) => {
  fastify.post<{ Body: PaymentRequestSchemaDTO; Reply: PaymentResponseSchemaDTO }>(
    '/payments',
    {
      preHandler: [opts.sessionAuthHook.authenticate()],
      schema: {
        body: PaymentRequestSchema,
        response: {
          200: PaymentResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const resp = await opts.paymentService.createPayment({
        data: request.body,
      });

      return reply.status(200).send(resp);
    },
  );

  fastify.post<{ Body: PaymentConfirmRequestSchemaDTO; Reply: PaymentIntentResponseSchemaDTO }>(
    '/payments/confirm',
    {
      preHandler: [opts.sessionAuthHook.authenticate()],
      schema: {
        body: PaymentConfirmationRequestSchema,
        response: {
          200: PaymentIntentResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const resp = await opts.paymentService.confirmPayment({
        data: request.body,
      });

      return reply.status(200).send(resp);
    },
  );
};
