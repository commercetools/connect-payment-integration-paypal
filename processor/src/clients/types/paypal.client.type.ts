export interface IPaypalPaymentAPI {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  healthCheck(): Promise<any>;
}

export enum PaypalBasePath {
  TEST = 'https://api-m.sandbox.paypal.com',
  LIVE = 'https://api-m.paypal.com',
}

export enum PaypalUrls {
  AUTHENTICATION = '/v1/oauth2/token',
  HEALTH_CHECK = '/v1/notifications/webhooks-event-types',
  ORDERS = '/v2/checkout/orders',
  GET_ORDERS = '/v2/checkout/orders/{resourceId}',
  ORDERS_CAPTURE = '/v2/checkout/orders/{resourceId}/capture',
  ORDERS_REFUND = '/v2/payments/captures/{resourceId}/refund',
  NOTIFICATION_VERIFY = '/v1/notifications/verify-webhook-signature',
}

export enum VerificationStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
}

export enum OrderStatus {
  PAYER_ACTION_REQUIRED = 'PAYER_ACTION_REQUIRED',
  COMPLETED = 'COMPLETED',
}

export type AuthenticationResponse = {
  status: number;
  accessToken: string;
};

export type Amount = {
  currency_code: string;
  value: string;
  breakdown?: {
    item_total?: {
      currency_code: string;
      value: string;
    };
    shipping?: {
      currency_code: string;
      value: string;
    };
    tax_total?: {
      currency_code: string;
      value: string;
    };
  };
};

export type PaypalShipping = {
  type?: string;
  name?: {
    full_name: string;
  };
  address?: {
    address_line_1?: string;
    address_line_2?: string;
    postal_code?: string;
    admin_area_2?: string;
    country_code: string;
    admin_area_1?: string;
  };
};

export type PaypalItem = {
  name: string;
  quantity: string;
  description?: string;
  sku?: string;
  category?: string;
  unit_amount: Amount;
  tax?: {
    currency_code: string;
    value: string;
  };
};

export type Capture = {
  status: string;
  id: string;
  amount: Amount;
};

export type Payment = {
  captures: Capture[];
};

type PurchaseUnits = {
  reference_id: string;
  amount: Amount;
  invoice_id: string;
  items?: PaypalItem[];
  shipping: PaypalShipping;
  payments?: Payment;
};

export type CreateOrderRequest = {
  intent: string;
  purchase_units: PurchaseUnits[];
  payment_source: {
    paypal: {
      experience_context: {
        payment_method_preference?: string;
        payment_method_selected?: string;
        user_action?: string;
        locale?: string;
      };
    };
  };
};

export type NotificationVerificationRequest = {
  auth_algo: string;
  cert_url: string;
  transmission_id: string;
  transmission_sig: string;
  transmission_time: string;
  webhook_id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webhook_event: Record<string, any>;
};

export type CaptureOrderResponse = {
  id: string; // order ID
  purchase_units: PurchaseUnits[];
  status: string;
};

export type CreateOrderResponse = {
  id: string;
  status: string;
};

export type GetOrderResponse = {
  id: string;
  purchase_units: PurchaseUnits[];
};

export type RefundResponse = {
  id: string;
  status: string;
  amount: Amount;
};

export type NotificationVerificationResponse = {
  verification_status: VerificationStatus;
};

export const parseAmount = (amountInCents: number): string => {
  const amount = Math.floor(amountInCents / 100);
  const cents = amountInCents % 100;

  return `${amount}.${cents.toString().padStart(2, '0')}`;
};
