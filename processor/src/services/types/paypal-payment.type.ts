import { CaptureOrderRequestDTO } from '../../dtos/paypal-payment.dto';

export type OrderConfirmation = {
  data: CaptureOrderRequestDTO & { orderId: string };
};

export enum PaymentOutcome {
  AUTHORIZED = 'Authorized',
  REJECTED = 'Rejected',
}

export enum TransactionStates {
  SUCCESS = 'Success',
  FAILURE = 'Failure',
  PENDING = 'Pending',
  INITIAL = 'Initial',
}

export enum TransactionTypes {
  AUTHORIZATION = 'Authorization',
  CANCEL_AUTHORIZATION = 'CancelAuthorization',
  CHARGE = 'Charge',
  REFUND = 'Refund',
  CHARGE_BACK = 'Chargeback',
}

/**
 * Defines the different types of notifications PayPal might send. Maps to the `event_type` attribute on a root level of a notification.
 * @see https://developer.paypal.com/api/rest/webhooks/event-names/#link-v
 */
export enum NotificationEventType {
  PAYMENT_CAPTURE_DECLINED = 'PAYMENT.CAPTURE.DECLINED',
  PAYMENT_CAPTURE_COMPLETED = 'PAYMENT.CAPTURE.COMPLETED',
  PAYMENT_CAPTURE_REFUNDED = 'PAYMENT.CAPTURE.REFUNDED',
  PAYMENT_CAPTURE_REVERSED = 'PAYMENT.CAPTURE.REVERSED',
}
