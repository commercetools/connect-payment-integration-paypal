import { config } from '../config/config';
import { AmountSchemaDTO, PaymentModificationStatus } from '../dtos/operations/payment-intents.dto';
import { PaypalApiError } from '../errors/paypal-api.error';
import { PaymentProviderModificationResponse } from '../services/types/operation.type';
import {
  AuthenticationResponse,
  CreateOrderRequest,
  IPaypalPaymentAPI,
  PaypalBasePath,
  PaypalUrls,
  parseAmount,
} from '../services/types/paypal-api.type';
import { ErrorGeneral, Errorx } from '@commercetools/connect-payments-sdk';
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

  public async createOrder(payload: CreateOrderRequest): Promise<PaymentProviderModificationResponse> {
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

      return {
        outcome: PaymentModificationStatus.APPROVED,
        pspReference: data.id,
      };
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

  public async captureOrder(resourceId: string | undefined): Promise<PaymentProviderModificationResponse> {
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

      return this.convertCaptureOrderResponse(data);
    } catch (e) {
      if (e instanceof Errorx) {
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
    payload: AmountSchemaDTO,
  ): Promise<PaymentProviderModificationResponse> {
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

      return {
        outcome: PaymentModificationStatus.APPROVED,
        pspReference: data.id,
      };
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

  public async refundFullPayment(paymentReference: string | undefined): Promise<PaymentProviderModificationResponse> {
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

      return {
        outcome: PaymentModificationStatus.APPROVED,
        pspReference: data.id,
      };
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

  private convertCaptureOrderResponse(data: any): PaymentProviderModificationResponse {
    return {
      outcome: this.convertCaptureOrderStatus(data),
      pspReference: this.extractCaptureId(data),
    };
  }

  private extractCaptureId(data: any): string {
    if (
      data.purchase_units &&
      data.purchase_units.length > 0 &&
      data.purchase_units[0]?.payments?.captures &&
      data.purchase_units[0]?.payments?.captures.length > 0 &&
      data.purchase_units[0]?.payments?.captures[0]?.id
    ) {
      return data.purchase_units[0].payments.captures[0].id;
    } else {
      throw new ErrorGeneral(undefined, {
        privateMessage: 'not able to extract the capture ID',
      });
    }
  }

  private convertCaptureOrderStatus(data: any): PaymentModificationStatus {
    if (data?.status) {
      const result = data.status as string;
      if (result.toUpperCase() === 'COMPLETED') {
        return PaymentModificationStatus.APPROVED;
      } else {
        return PaymentModificationStatus.REJECTED;
      }
    } else {
      throw new ErrorGeneral(undefined, {
        privateMessage: 'capture status not received.',
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
