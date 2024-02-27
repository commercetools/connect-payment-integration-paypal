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

export const OrderRequestSchema = Type.Object({
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

export const OrderResponseSchema = Type.Object({
  id: Type.String(),
  paymentReference: Type.String(),
});

export const OrderCaptureRequestSchema = Type.Object({
  paymentReference: Type.String(),
});

export const OrderCaptureResponseSchema = Type.Object({
  id: Type.String(),
  paymentReference: Type.String(),
});

export const OrderCaptureParamsSchema = Type.Object({
  id: Type.String(),
});

export type OrderRequestSchemaDTO = Static<typeof OrderRequestSchema>;
export type OrderResponseSchemaDTO = Static<typeof OrderResponseSchema>;

export type OrderCaptureRequestSchemaDTO = Static<typeof OrderCaptureRequestSchema>;
export type OrderCaptureResponseSchemaDTO = Static<typeof OrderCaptureResponseSchema>;

export type OrderCaptureParamsSchemaDTO = Static<typeof OrderCaptureParamsSchema>;
