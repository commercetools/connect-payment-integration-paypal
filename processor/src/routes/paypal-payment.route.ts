import { SessionAuthenticationHook } from '@commercetools/connect-payments-sdk';
import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  CreateOrderRequestDTO,
  CreateOrderResponseDTO,
  CaptureOrderRequestDTO,
  CaptureOrderResponseDTO,
  CaptureOrderParamsDTO,
  OrderRequest,
  OrderResponse,
  CaptureOrderResponse,
  CaptureOrderRequest,
  NotificationPayloadDTO,
  NotificationPayload,
} from '../dtos/paypal-payment.dto';
import { PaypalPaymentService } from '../services/paypal-payment.service';
import { WebhookVerificationHook } from '../libs/fastify/hooks/paypal-webhook-verification';

type PaymentRoutesOptions = {
  paymentService: PaypalPaymentService;
  sessionAuthHook: SessionAuthenticationHook;
  signatureAuthHook: WebhookVerificationHook;
};

export const paymentRoutes = async (fastify: FastifyInstance, opts: FastifyPluginOptions & PaymentRoutesOptions) => {
  fastify.post<{ Body: CreateOrderRequestDTO; Reply: CreateOrderResponseDTO }>(
    '/checkout/orders',
    {
      preHandler: [opts.sessionAuthHook.authenticate()],
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
    Body: CaptureOrderRequestDTO;
    Reply: CaptureOrderResponseDTO;
  }>(
    '/checkout/orders/:id/capture',
    {
      preHandler: [opts.sessionAuthHook.authenticate()],
      schema: {
        body: CaptureOrderRequest,
        response: {
          200: CaptureOrderResponse,
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
