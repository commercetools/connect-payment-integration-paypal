import { Static, Type } from '@sinclair/typebox';

export const PaypalPaymentMethodSchema = Type.Object({
  // TODO: Remove the fields according to the payment provider solution,
  //  Strongly recommend not to process PAN data to Connectors.
  type: Type.Literal('paypal'),
});

export const PaymentRequestSchema = Type.Object({
  paymentMethod: Type.Composite([PaypalPaymentMethodSchema]),
});

export const PaymentConfirmationRequestSchema = Type.Object({
  details: Type.Object({
    pspReference: Type.String(),
    paymentReference: Type.String(),
  }),
});

export enum PaymentOutcome {
  AUTHORIZED = 'Authorized',
  REJECTED = 'Rejected',
}

export const PaymentOutcomeSchema = Type.Enum(PaymentOutcome);

export const PaymentResponseSchema = Type.Object({
  outcome: PaymentOutcomeSchema,
  paymentReference: Type.String(),
});

export type PaymentRequestSchemaDTO = Static<typeof PaymentRequestSchema>;
export type PaymentConfirmRequestSchemaDTO = Static<typeof PaymentConfirmationRequestSchema>;
export type PaymentResponseSchemaDTO = Static<typeof PaymentResponseSchema>;
