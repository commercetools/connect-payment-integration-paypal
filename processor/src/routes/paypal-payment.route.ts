import { SessionHeaderAuthenticationHook } from '@commercetools/connect-payments-sdk';
import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  CaptureOrderParamsDTO,
  CaptureOrderResponse,
  CaptureOrderResponseDTO,
  CreateOrderRequestDTO,
  CreateOrderResponseDTO,
  NotificationPayload,
  NotificationPayloadDTO,
  OrderRequest,
  OrderResponse,
} from '../dtos/paypal-payment.dto';
import { PaypalPaymentService } from '../services/paypal-payment.service';
import { WebhookVerificationHook } from '../libs/fastify/hooks/paypal-webhook-verification';

type PaymentRoutesOptions = {
  paymentService: PaypalPaymentService;
  sessionHeaderAuthHook: SessionHeaderAuthenticationHook;
  signatureAuthHook: WebhookVerificationHook;
};

export const paymentRoutes = async (fastify: FastifyInstance, opts: FastifyPluginOptions & PaymentRoutesOptions) => {
  fastify.post<{ Body: CreateOrderRequestDTO; Reply: CreateOrderResponseDTO }>(
    '/checkout/orders',
    {
      preHandler: [opts.sessionHeaderAuthHook.authenticate()],
      schema: {
        body: OrderRequest,
        response: {
          200: OrderResponse,
        },
      },
    },
    async (request, reply) => {
      const resp = await opts.paymentService.createPayment(request.body);

      return reply.status(200).send(resp);
    },
  );

  fastify.post<{
    Params: CaptureOrderParamsDTO;
    Reply: CaptureOrderResponseDTO;
  }>(
    '/checkout/orders/:id/capture',
    {
      preHandler: [opts.sessionHeaderAuthHook.authenticate()],
      schema: {
        response: {
          200: CaptureOrderResponse,
        },
      },
    },
    async (request, reply) => {
      const resp = await opts.paymentService.confirmPayment({
        data: {
          orderId: request.params.id,
        },
      });

      return reply.status(201).send(resp);
    },
  );

  fastify.post<{
    Body: NotificationPayloadDTO;
  }>(
    '/notifications',
    {
      preHandler: [opts.signatureAuthHook.authenticate()],
      schema: {
        body: NotificationPayload,
      },
    },
    async (request, reply) => {
      await opts.paymentService.processNotification({
        data: request.body,
      });
      return reply.status(200).send('[accepted]');
    },
  );
};
