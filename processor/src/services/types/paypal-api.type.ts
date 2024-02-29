export interface IPaypalPaymentAPI {
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
  ORDERS_CAPTURE = '/v2/checkout/orders/{resourceId}/capture',
  ORDERS_REFUND = '/v2/payments/captures/{resourceId}/refund',
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
  unit_amount: {
    currency_code: string;
    value: string;
  };
  tax?: {
    currency_code: string;
    value: string;
  };
};

type PurchaseUnits = {
  reference_id: string;
  amount: Amount;
  invoice_id: string;
  items?: PaypalItem[];
  shipping: PaypalShipping;
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

export const parseAmount = (amountInCents: number): string => {
  const amount = Math.floor(amountInCents / 100);
  const cents = amountInCents % 100;

  return `${amount}.${cents.toString().padStart(2, '0')}`;
};