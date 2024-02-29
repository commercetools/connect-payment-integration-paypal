import { Static, Type } from '@sinclair/typebox';

export enum PaymentOutcome {
  AUTHORIZED = 'Authorized',
  REJECTED = 'Rejected',
}

export enum Intent {
  CAPTURE = 'CAPTURE',
  AUTHORIZE = 'AUTHORIZE',
}

export const PaymentOutcomeSchema = Type.Enum(PaymentOutcome);

export const OrderRequest = Type.Object({
  intent: Type.Enum(Intent),
  payment_source: Type.Object({
    paypal: Type.Object({
      experience_context: Type.Object({
        payment_method_preference: Type.Optional(Type.String()),
        payment_method_selected: Type.Optional(Type.String()),
        user_action: Type.Optional(Type.String()),
        locale: Type.Optional(Type.String()),
      }),
    }),
  }),
});

export const OrderResponse = Type.Object({
  id: Type.String(),
  paymentReference: Type.String(),
});

export const CaptureOrderRequest = Type.Object({
  paymentReference: Type.String(),
});

export const CaptureOrderResponse = Type.Object({
  id: Type.String(),
  paymentReference: Type.String(),
});

export const CaptureOrderParams = Type.Object({
  id: Type.String(),
});

export type CreateOrderRequestDTO = Static<typeof OrderRequest>;
export type CreateOrderResponseDTO = Static<typeof OrderResponse>;

export type CaptureOrderRequestDTO = Static<typeof CaptureOrderRequest>;
export type CaptureOrderResponseDTO = Static<typeof CaptureOrderResponse>;

export type CaptureOrderParamsDTO = Static<typeof CaptureOrderParams>;
