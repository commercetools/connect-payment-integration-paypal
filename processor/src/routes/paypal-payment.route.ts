import { SessionAuthenticationHook } from '@commercetools/connect-payments-sdk';
import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  OrderRequestSchemaDTO,
  OrderRequestSchema,
  OrderResponseSchemaDTO,
  OrderResponseSchema,
  OrderCaptureRequestSchemaDTO,
  OrderCaptureRequestSchema,
  OrderCaptureResponseSchemaDTO,
  OrderCaptureResponseSchema,
  OrderCaptureParamsSchemaDTO,
} from '../dtos/paypal-payment.dto';
import { PaypalPaymentService } from '../services/paypal-payment.service';

type PaymentRoutesOptions = {
  paymentService: PaypalPaymentService;
  sessionAuthHook: SessionAuthenticationHook;
};

export const paymentRoutes = async (fastify: FastifyInstance, opts: FastifyPluginOptions & PaymentRoutesOptions) => {
  fastify.post<{ Body: OrderRequestSchemaDTO; Reply: OrderResponseSchemaDTO }>(
    '/checkout/orders',
    {
      preHandler: [opts.sessionAuthHook.authenticate()],
      schema: {
        body: OrderRequestSchema,
        response: {
          200: OrderResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const resp = await opts.paymentService.createPayment(request.body);

      return reply.status(200).send(resp);
    },
  );

  fastify.post<{
    Params: OrderCaptureParamsSchemaDTO;
    Body: OrderCaptureRequestSchemaDTO;
    Reply: OrderCaptureResponseSchemaDTO;
  }>(
    '/checkout/orders/:id/capture',
    {
      preHandler: [opts.sessionAuthHook.authenticate()],
      schema: {
        body: OrderCaptureRequestSchema,
        response: {
          200: OrderCaptureResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const resp = await opts.paymentService.confirmPayment({
        data: {
          ...request.body,
          orderId: request.params.id,
        },
      });

      return reply.status(201).send(resp);
    },
  );
};
