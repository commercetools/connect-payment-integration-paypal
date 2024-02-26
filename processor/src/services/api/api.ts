import { config } from '../../config/config';
import { AmountSchemaDTO, PaymentModificationStatus } from '../../dtos/operations/payment-intents.dto';
import { PaymentProviderModificationResponse } from '../types/operation.type';
import {
  AuthenticationResponse,
  CreateOrderRequest,
  IPaypalPaymentAPI,
  PaypalBasePath,
  PaypalUrls,
  parseAmount,
} from '../types/paypal-api.type';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { ErrorGeneral } from '@commercetools/connect-payments-sdk';
import { Money } from '@commercetools/platform-sdk';
import { randomUUID } from 'crypto';

export class PaypalPaymentAPI implements IPaypalPaymentAPI {
  async healthCheck(): Promise<AxiosResponse | undefined> {
    const url = this.buildResourceUrl(config.paypalEnvironment, PaypalUrls.HEALTH_CHECK);

    try {
      const auth = await this.authenticateRequest();
      const options = {
        url,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.accessToken}`,
        },
      };

      return await axios(options);
    } catch (e) {
      throw new ErrorGeneral();
    }
  }

  async createOrder(payload: CreateOrderRequest): Promise<PaymentProviderModificationResponse> {
    const url = this.buildResourceUrl(config.paypalEnvironment, PaypalUrls.ORDERS);
    try {
      const auth = await this.authenticateRequest();
      const options = {
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'PayPal-Request-Id': randomUUID(), // required for idempotency BY PAYPAL
          'PayPal-Partner-Attribution-Id': 'commercetools_Cart_Checkout',
          Authorization: `Bearer ${auth.accessToken}`,
        },
        data: JSON.stringify(payload),
      };

      const response = await axios(options);
      return {
        outcome: PaymentModificationStatus.APPROVED,
        pspReference: response.data.id,
      };
    } catch (e) {
      const errorData: any = (e as AxiosError).response?.data;
      throw new ErrorGeneral('not able to create a paypal order', {
        fields: {
          payPalCorrelationId: errorData?.debug_id,
          url,
          apiError: errorData ? JSON.stringify(errorData) : 'not able to create a paypal order',
        },
        cause: e,
      });
    }
  }

  async captureOrder(resourceId: string | undefined): Promise<PaymentProviderModificationResponse> {
    const url = this.buildResourceUrl(config.paypalEnvironment, PaypalUrls.ORDERS_CAPTURE, resourceId);
    try {
      const auth = await this.authenticateRequest();
      const options = {
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'PayPal-Request-Id': randomUUID(), // required for idempotency BY PAYPAL
          'PayPal-Partner-Attribution-Id': 'commercetools_Cart_Checkout',
          Authorization: `Bearer ${auth.accessToken}`,
        },
      };

      const response = await axios(options);

      return this.convertCaptureOrderResponse(response.data);
    } catch (e) {
      const errorData: any = (e as AxiosError).response?.data;
      throw new ErrorGeneral('not able to capture the paypal order', {
        fields: {
          payPalCorrelationId: errorData?.debug_id,
          url,
          apiError: errorData ? JSON.stringify(errorData) : 'not able to capture the paypal order',
        },
        cause: e,
      });
    }
  }

  async refundPartialPayment(
    paymentReference: string | undefined,
    payload: AmountSchemaDTO,
  ): Promise<PaymentProviderModificationResponse> {
    const url = this.buildResourceUrl(config.paypalEnvironment, PaypalUrls.ORDERS_REFUND, paymentReference);

    const data = this.convertToPaypalAmount(payload);

    try {
      const auth = await this.authenticateRequest();
      const options = {
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'PayPal-Request-Id': randomUUID(), // required for idempotency BY PAYPAL
          'PayPal-Partner-Attribution-Id': 'commercetools_Cart_Checkout',
          Authorization: `Bearer ${auth.accessToken}`,
        },
        data: JSON.stringify(data),
      };

      const response = await axios(options);
      return {
        outcome: PaymentModificationStatus.APPROVED,
        pspReference: response.data.id,
      };
    } catch (e) {
      const errorData: any = (e as AxiosError).response?.data;
      throw new ErrorGeneral('not able to partially refund a payment', {
        fields: {
          payPalCorrelationId: errorData?.debug_id,
          url,
          apiError: errorData ? JSON.stringify(errorData) : 'not able to partially refund a payment',
        },
        cause: e,
      });
    }
  }

  async refundFullPayment(paymentReference: string | undefined): Promise<PaymentProviderModificationResponse> {
    const url = this.buildResourceUrl(config.paypalEnvironment, PaypalUrls.ORDERS_REFUND, paymentReference);

    try {
      const auth = await this.authenticateRequest();
      const options = {
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'PayPal-Request-Id': randomUUID(), // required for idempotency BY PAYPAL
          'PayPal-Partner-Attribution-Id': 'commercetools_Cart_Checkout',
          Authorization: `Bearer ${auth.accessToken}`,
        },
      };

      const response = await axios(options);
      return {
        outcome: PaymentModificationStatus.APPROVED,
        pspReference: response.data.id,
      };
    } catch (e) {
      const errorData: any = (e as AxiosError).response?.data;
      throw new ErrorGeneral('not able to fully refund a payment', {
        fields: {
          payPalCorrelationId: errorData?.debug_id,
          url,
          apiError: errorData ? JSON.stringify(errorData) : 'not able to fully refund a payment',
        },
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

  async authenticateRequest(): Promise<AuthenticationResponse> {
    const url = this.buildResourceUrl(config.paypalEnvironment, PaypalUrls.AUTHENTICATION);

    try {
      const options = {
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: config.paypalClientId,
          password: config.paypalClientSecret,
        },
        params: {
          grant_type: 'client_credentials',
        },
      };

      const { status, data } = await axios(options);

      return {
        status,
        accessToken: data.access_token,
      };
    } catch (e) {
      throw new ErrorGeneral('Error while authenticating with payment provider.', {
        privateMessage: 'error occurred due to failed authorization request to paypal',
        cause: e,
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
