import { config } from '../config/config';
import { AmountSchemaDTO } from '../dtos/operations/payment-intents.dto';
import { PaypalApiError } from '../errors/paypal-api.error';
import {
  AuthenticationResponse,
  CaptureOrderResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  IPaypalPaymentAPI,
  NotificationVerificationRequest,
  NotificationVerificationResponse,
  PaypalBasePath,
  PaypalUrls,
  RefundResponse,
  parseAmount,
} from './types/paypal.client.type';
import { ErrorGeneral } from '@commercetools/connect-payments-sdk';
import { Money } from '@commercetools/platform-sdk';
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
          debug_id: error.debug_id,
          message: error.message,
        };

        throw new PaypalApiError(errorData);
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
          debug_id: error.debug_id,
          message: error.message,
        };

        throw new PaypalApiError(errorData, {
          fields: {
            details: error.details,
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
          debug_id: error.debug_id,
          message: error.message,
        };

        throw new PaypalApiError(errorData, {
          fields: {
            details: error.details,
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
    payload: AmountSchemaDTO, // amount should be converted before sent, create a static method for converting amount in this class, to be used by any service needing it PAYPALAPI.convert_amount
  ): Promise<RefundResponse> {
    const url = this.buildResourceUrl(config.paypalEnvironment, PaypalUrls.ORDERS_REFUND, paymentReference);

    const paypalAmount = this.convertToPaypalAmount(payload);

    const auth = await this.authenticateRequest();
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PayPal-Request-Id': randomUUID(), // required for idempotency BY PAYPAL
        'PayPal-Partner-Attribution-Id': 'commercetools_Cart_Checkout',
        Authorization: `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify(paypalAmount),
    };

    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const error = await res.json().catch(() => ({})); // Graceful handling if JSON parsing fails
        const errorData = {
          status: res.status,
          name: error.name,
          debug_id: error.debug_id,
          message: error.message,
        };

        throw new PaypalApiError(errorData, {
          fields: {
            details: error.details,
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
          debug_id: error.debug_id,
          message: error.message,
        };

        throw new PaypalApiError(errorData, {
          fields: {
            details: error.details,
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
          debug_id: error.debug_id,
          message: error.message,
        };

        throw new PaypalApiError(errorData, {
          fields: {
            details: error.details,
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
          debug_id: res.headers.get('paypal-debug-id'),
          message: error.error_description,
        };

        throw new PaypalApiError(errorData);
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

  private convertToPaypalAmount(amount: Money) {
    return {
      amount: {
        currency_code: amount.currencyCode,
        value: parseAmount(amount.centAmount),
      },
    };
  }
}
