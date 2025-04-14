import { config } from '../config/config';
import { PaypalApiError } from '../errors/paypal-api.error';
import { PartialRefundPayload } from '../services/converters/partial-refund.converter';
import {
  AuthenticationResponse,
  CaptureOrderResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  GetOrderResponse,
  IPaypalPaymentAPI,
  NotificationVerificationRequest,
  NotificationVerificationResponse,
  PaypalBasePath,
  PaypalUrls,
  RefundResponse,
} from './types/paypal.client.type';
import { ErrorGeneral } from '@commercetools/connect-payments-sdk';
import { randomUUID } from 'crypto';

export class PaypalAPI implements IPaypalPaymentAPI {
  public async healthCheck(): Promise<Response | undefined> {
    const url = this.buildResourceUrl(config.paypalEnvironment, PaypalUrls.HEALTH_CHECK);

    const auth = await this.authenticateRequest();
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.accessToken}`,
      },
    };

    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const error = await res.json().catch(() => ({})); // Graceful handling if JSON parsing fails
        const errorData = {
          status: res.status,
          name: error.name,
          message: error.message,
        };

        throw new PaypalApiError(errorData, {
          fields: {
            debug_id: error.debug_id || res.headers.get('paypal-debug-id'),
          },
        });
      }

      return res;
    } catch (e) {
      if (e instanceof PaypalApiError) {
        throw e;
      }

      throw new ErrorGeneral(undefined, {
        privateMessage: 'Failed due to network error or internal computations',
        cause: e,
      });
    }
  }

  public async getOrder(id: string): Promise<GetOrderResponse> {
    const url = this.buildResourceUrl(config.paypalEnvironment, PaypalUrls.GET_ORDERS, id);
    const auth = await this.authenticateRequest();
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'PayPal-Request-Id': randomUUID(), // required for idempotency BY PAYPAL
        'PayPal-Partner-Attribution-Id': 'commercetools_Cart_Checkout',
        Authorization: `Bearer ${auth.accessToken}`,
      },
    };

    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const error = await res.json().catch(() => ({})); // Graceful handling if JSON parsing fails
        const errorData = {
          status: res.status,
          name: error.name,
          message: error.message,
        };

        throw new PaypalApiError(errorData, {
          fields: {
            details: error.details,
            debug_id: error.debug_id || res.headers.get('paypal-debug-id'),
          },
        });
      }

      const data = await res.json().catch(() => {
        throw new ErrorGeneral(undefined, {
          privateMessage: 'Failed to parse response JSON',
        });
      });

      return data as GetOrderResponse;
    } catch (e) {
      if (e instanceof PaypalApiError) {
        throw e;
      }

      throw new ErrorGeneral(undefined, {
        privateMessage: 'Failed due to network error or internal computations',
        cause: e,
      });
    }
  }

  public async createOrder(payload: CreateOrderRequest): Promise<CreateOrderResponse> {
    const url = this.buildResourceUrl(config.paypalEnvironment, PaypalUrls.ORDERS);
    const auth = await this.authenticateRequest();
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PayPal-Request-Id': randomUUID(), // required for idempotency BY PAYPAL
        'PayPal-Partner-Attribution-Id': 'commercetools_Cart_Checkout',
        Authorization: `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify(payload),
    };

    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const error = await res.json().catch(() => ({})); // Graceful handling if JSON parsing fails
        const errorData = {
          status: res.status,
          name: error.name,
          message: error.message,
        };

        throw new PaypalApiError(errorData, {
          fields: {
            details: error.details,
            debug_id: error.debug_id || res.headers.get('paypal-debug-id'),
          },
        });
      }

      const data = await res.json().catch(() => {
        throw new ErrorGeneral(undefined, {
          privateMessage: 'Failed to parse response JSON',
        });
      });

      return data as CreateOrderResponse;
    } catch (e) {
      if (e instanceof PaypalApiError) {
        throw e;
      }

      throw new ErrorGeneral(undefined, {
        privateMessage: 'Failed due to network error or internal computations',
        cause: e,
      });
    }
  }

  public async captureOrder(resourceId: string | undefined): Promise<CaptureOrderResponse> {
    const url = this.buildResourceUrl(config.paypalEnvironment, PaypalUrls.ORDERS_CAPTURE, resourceId);
    const auth = await this.authenticateRequest();
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PayPal-Request-Id': randomUUID(), // required for idempotency BY PAYPAL
        'PayPal-Partner-Attribution-Id': 'commercetools_Cart_Checkout',
        Authorization: `Bearer ${auth.accessToken}`,
      },
    };

    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const error = await res.json().catch(() => ({})); // Graceful handling if JSON parsing fails

        const errorData = {
          status: res.status,
          name: error.name,
          message: error.message,
        };

        throw new PaypalApiError(errorData, {
          fields: {
            details: error.details,
            debug_id: error.debug_id || res.headers.get('paypal-debug-id'),
          },
        });
      }

      const data = await res.json().catch(() => {
        throw new ErrorGeneral(undefined, {
          privateMessage: 'Failed to parse response JSON',
        });
      });

      return data as CaptureOrderResponse;
    } catch (e) {
      if (e instanceof PaypalApiError) {
        throw e;
      }

      throw new ErrorGeneral(undefined, {
        privateMessage: 'Failed due to network error or internal computations',
        cause: e,
      });
    }
  }

  public async refundPartialPayment(
    paymentReference: string | undefined,
    payload: PartialRefundPayload,
  ): Promise<RefundResponse> {
    const url = this.buildResourceUrl(config.paypalEnvironment, PaypalUrls.ORDERS_REFUND, paymentReference);

    const auth = await this.authenticateRequest();
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PayPal-Request-Id': randomUUID(), // required for idempotency BY PAYPAL
        'PayPal-Partner-Attribution-Id': 'commercetools_Cart_Checkout',
        Authorization: `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify(payload),
    };

    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const error = await res.json().catch(() => ({})); // Graceful handling if JSON parsing fails
        const errorData = {
          status: res.status,
          name: error.name,
          message: error.message,
        };

        throw new PaypalApiError(errorData, {
          fields: {
            details: error.details,
            debug_id: error.debug_id || res.headers.get('paypal-debug-id'),
          },
        });
      }

      const data = (await res.json().catch(() => {
        throw new ErrorGeneral(undefined, {
          privateMessage: 'Failed to parse response JSON',
        });
      })) as RefundResponse;

      return await this.getRefund(data.id);
    } catch (e) {
      if (e instanceof PaypalApiError) {
        throw e;
      }

      throw new ErrorGeneral(undefined, {
        privateMessage: 'Failed due to network error or internal computations',
        cause: e,
      });
    }
  }

  public async refundFullPayment(paymentReference: string | undefined): Promise<RefundResponse> {
    const url = this.buildResourceUrl(config.paypalEnvironment, PaypalUrls.ORDERS_REFUND, paymentReference);

    const auth = await this.authenticateRequest();
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PayPal-Request-Id': randomUUID(), // required for idempotency BY PAYPAL
        'PayPal-Partner-Attribution-Id': 'commercetools_Cart_Checkout',
        Authorization: `Bearer ${auth.accessToken}`,
      },
    };

    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const error = await res.json().catch(() => ({})); // Graceful handling if JSON parsing fails
        const errorData = {
          status: res.status,
          name: error.name,
          message: error.message,
        };

        throw new PaypalApiError(errorData, {
          fields: {
            details: error.details,
            debug_id: error.debug_id || res.headers.get('paypal-debug-id'),
          },
        });
      }

      const data = (await res.json().catch(() => {
        throw new ErrorGeneral(undefined, {
          privateMessage: 'Failed to parse response JSON',
        });
      })) as RefundResponse;

      return await this.getRefund(data.id);
    } catch (e) {
      if (e instanceof PaypalApiError) {
        throw e;
      }

      throw new ErrorGeneral(undefined, {
        privateMessage: 'Failed due to network error or internal computations',
        cause: e,
      });
    }
  }

  public async getRefund(id: string): Promise<RefundResponse> {
    const url = this.buildResourceUrl(config.paypalEnvironment, PaypalUrls.GET_REFUND, id);
    const auth = await this.authenticateRequest();
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'PayPal-Request-Id': randomUUID(), // required for idempotency BY PAYPAL
        'PayPal-Partner-Attribution-Id': 'commercetools_Cart_Checkout',
        Authorization: `Bearer ${auth.accessToken}`,
      },
    };

    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const error = await res.json().catch(() => ({})); // Graceful handling if JSON parsing fails
        const errorData = {
          status: res.status,
          name: error.name,
          message: error.message,
        };

        throw new PaypalApiError(errorData, {
          fields: {
            details: error.details,
            debug_id: error.debug_id || res.headers.get('paypal-debug-id'),
          },
        });
      }

      const data = await res.json().catch(() => {
        throw new ErrorGeneral(undefined, {
          privateMessage: 'Failed to parse response JSON',
        });
      });

      return data as RefundResponse;
    } catch (e) {
      if (e instanceof PaypalApiError) {
        throw e;
      }

      throw new ErrorGeneral(undefined, {
        privateMessage: 'Failed due to network error or internal computations',
        cause: e,
      });
    }
  }

  public async verifyNotification(payload: NotificationVerificationRequest): Promise<NotificationVerificationResponse> {
    const url = this.buildResourceUrl(config.paypalEnvironment, PaypalUrls.NOTIFICATION_VERIFY);

    const auth = await this.authenticateRequest();
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PayPal-Request-Id': randomUUID(), // required for idempotency BY PAYPAL
        'PayPal-Partner-Attribution-Id': 'commercetools_Cart_Checkout',
        Authorization: `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify(payload),
    };

    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const error = await res.json().catch(() => ({})); // Graceful handling if JSON parsing fails
        const errorData = {
          status: res.status,
          name: error.name,
          message: error.message,
        };

        throw new PaypalApiError(errorData, {
          fields: {
            details: error.details,
            debug_id: error.debug_id || res.headers.get('paypal-debug-id'),
          },
        });
      }

      const data = await res.json().catch(() => {
        throw new ErrorGeneral(undefined, {
          privateMessage: 'Failed to parse response JSON',
        });
      });

      return data as NotificationVerificationResponse;
    } catch (e) {
      if (e instanceof PaypalApiError) {
        throw e;
      }

      throw new ErrorGeneral(undefined, {
        privateMessage: 'Failed due to network error or internal computations',
        cause: e,
      });
    }
  }

  private buildResourceUrl(environment: string, resource: PaypalUrls, resourceId?: string): string {
    let url = `${PaypalBasePath.TEST.toString()}${resource}`;
    if (environment.toLowerCase() === 'live') {
      url = `${PaypalBasePath.LIVE.toString()}${resource}`;
    }

    if (resourceId) {
      url = url.replace(/{resourceId}/g, resourceId);
    }

    return url;
  }

  public async authenticateRequest(): Promise<AuthenticationResponse> {
    const url = this.buildResourceUrl(config.paypalEnvironment, PaypalUrls.AUTHENTICATION);
    const encodedCredentials = btoa(`${config.paypalClientId}:${config.paypalClientSecret}`);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${encodedCredentials}`,
      },
      body: 'grant_type=client_credentials',
    };

    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const error = await res.json().catch(() => ({})); // Graceful handling if JSON parsing fails
        const errorData = {
          status: res.status,
          name: error.error,
          message: error.error_description,
        };

        throw new PaypalApiError(errorData, {
          fields: {
            debug_id: res.headers.get('paypal-debug-id'),
          },
        });
      }

      const { access_token: accessToken } = await res.json().catch(() => {
        throw new ErrorGeneral(undefined, {
          privateMessage: 'Failed to parse response JSON',
        });
      });

      return {
        status: res.status,
        accessToken,
      };
    } catch (e) {
      if (e instanceof PaypalApiError) {
        throw e;
      }

      throw new ErrorGeneral('Network error', {
        privateMessage: 'Failed due to network error',
      });
    }
  }
}
