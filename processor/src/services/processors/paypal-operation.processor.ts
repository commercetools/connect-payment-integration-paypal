import { healthCheckCommercetoolsPermissions, statusHandler } from '@commercetools/connect-payments-sdk';
import { config } from '../../config/config';
import { PaymentModificationStatus } from '../../dtos/operations/payment-intents.dto';
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
  async config(): Promise<ConfigResponse> {
    return {
      clientId: config.paypalClientId,
      environment: config.paypalEnvironment,
    };
  }

  async status(): Promise<StatusResponse> {
    const paypalAPI = new PaypalPaymentAPI();
    const handler = await statusHandler({
      timeout: config.healthCheckTimeout,
      checks: [
        healthCheckCommercetoolsPermissions({
          requiredPermissions: ['manage_project', 'manage_checkout_payment_intents'],
          ctAuthorizationService: paymentSDK.ctAuthorizationService,
          projectKey: config.projectKey,
        }),
        async () => {
          try {
            const healthCheck = await paypalAPI.healthCheck();
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
              throw new Error(healthCheck?.data?.message);
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
    return { outcome: PaymentModificationStatus.APPROVED, pspReference: request.payment.interfaceId as string };
  }

  async cancelPayment(request: CancelPaymentRequest): Promise<PaymentProviderModificationResponse> {
    return { outcome: PaymentModificationStatus.APPROVED, pspReference: request.payment.interfaceId as string };
  }

  async refundPayment(request: RefundPaymentRequest): Promise<PaymentProviderModificationResponse> {
    return { outcome: PaymentModificationStatus.APPROVED, pspReference: request.payment.interfaceId as string };
  }
}
