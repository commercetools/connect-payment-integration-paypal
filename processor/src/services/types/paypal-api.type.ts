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
}

export type AuthenticationResponse = {
  status: number;
  accessToken: string;
};

/**
 * Data for the PaypalApiError
 */
export interface PaypalApiErrorData {
  msg: string;
  statusCode?: number;
  url?: string;
  apiError?: string | undefined;
  paypalCorrelationId?: string;
}
