import { getConfig } from '../../config/config';
import { ErrorGeneral, healthCheckCommercetoolsPermissions, statusHandler } from '@commercetools/connect-payments-sdk';
import { paymentSDK } from '../../payment-sdk';
import {
  CancelPaymentRequest,
  CapturePaymentRequest,
  ConfigResponse,
  PaymentProviderModificationResponse,
  RefundPaymentRequest,
  StatusResponse,
} from '../types/operation.type';
import { OperationProcessor } from './operation.processor';
import { PaypalPaymentAPI } from '../api/api';
const packageJSON = require('../../../package.json');

export class PaypalOperationProcessor implements OperationProcessor {
  private paypalClient: PaypalPaymentAPI;
  constructor() {
    this.paypalClient = new PaypalPaymentAPI();
  }

  async config(): Promise<ConfigResponse> {
    return {
      clientId: getConfig().paypalClientId,
      environment: getConfig().paypalEnvironment,
    };
  }

  async status(): Promise<StatusResponse> {
    const handler = await statusHandler({
      timeout: getConfig().healthCheckTimeout,
      checks: [
        healthCheckCommercetoolsPermissions({
          requiredPermissions: ['manage_project', 'manage_checkout_payment_intents'],
          ctAuthorizationService: paymentSDK.ctAuthorizationService,
          projectKey: getConfig().projectKey,
        }),
        async () => {
          try {
            const healthCheck = await this.paypalClient.healthCheck();
            if (healthCheck?.status === 200) {
              const paymentMethods = 'paypal';
              return {
                name: 'Paypal Payment API',
                status: 'UP',
                details: {
                  paymentMethods,
                },
              };
            } else {
              throw new Error(healthCheck?.statusText);
            }
          } catch (e) {
            return {
              name: 'Paypal Payment API',
              status: 'DOWN',
              details: {
                // TODO do not expose the error
                error: (e as Error)?.message,
              },
            };
          }
        },
      ],
      metadataFn: async () => ({
        name: packageJSON.name,
        description: packageJSON.description,
        '@commercetools/sdk-client-v2': packageJSON.dependencies['@commercetools/sdk-client-v2'],
      }),
    })();

    return handler.body;
  }

  async capturePayment(request: CapturePaymentRequest): Promise<PaymentProviderModificationResponse> {
    return await this.paypalClient.captureOrder(request.payment.interfaceId);
  }

  async cancelPayment(request: CancelPaymentRequest): Promise<PaymentProviderModificationResponse> {
    throw new ErrorGeneral('operation not supported', {
      fields: {
        pspReference: request.payment.interfaceId,
      },
      privateMessage: "connector doesn't support cancel operation",
    });
  }

  async refundPayment(request: RefundPaymentRequest): Promise<PaymentProviderModificationResponse> {
    const transaction = request.payment.transactions.find((t) => t.type === 'Charge' && t.state === 'Success');
    const captureId = transaction?.interactionId;
    if (this.isPartialRefund(request)) {
      return this.paypalClient.refundPartialPayment(captureId, request.amount);
    }

    return this.paypalClient.refundFullPayment(captureId);
  }

  private isPartialRefund(request: RefundPaymentRequest): boolean {
    return request.payment.amountPlanned.centAmount > request.amount.centAmount;
  }
}
