import { describe, test, expect, afterEach, jest, afterAll, beforeAll, beforeEach } from '@jest/globals';
import { ConfigResponse, ModifyPayment, StatusResponse } from '../../src/services/types/operation.type';

import { paymentSDK } from '../../src/payment-sdk';
import { DefaultPaymentService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment.service';
import { DefaultCartService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-cart.service';
import { mockGetPaymentAmount, mockGetPaymentResult, mockUpdatePaymentResult } from '../utils/mock-payment-data';
import * as Config from '../../src/config/config';
import { PaypalPaymentServiceOptions } from '../../src/services/types/paypal-payment.type';
import { AbstractPaymentService } from '../../src/services/abstract-payment.service';
import { PaypalPaymentService } from '../../src/services/paypal-payment.service';
import { setupServer } from 'msw/node';
import { PaypalUrls, PaypalBasePath } from '../../src/clients/types/paypal.client.type';
import {
  paypalAuthenticationResponse,
  paypalCaptureOrderOkResponse,
  paypalCreateOrderOkResponse,
  paypalRefundOkResponse,
} from '../utils/mock-paypal-response-data';
import { mockPaypalGetRequest, mockPaypalRequest } from '../utils/paypal-request.mock';
import { mockGetCartResult } from '../utils/mock-cart-data';
import { HealthCheckResult } from '@commercetools/connect-payments-sdk';
import * as StatusHandler from '@commercetools/connect-payments-sdk/dist/api/handlers/status.handler';
import * as FastifyContext from '../../src/libs/fastify/context/context';
import { CreateOrderRequestDTO, Intent } from '../../src/dtos/paypal-payment.dto';

interface FlexibleConfig {
  [key: string]: string | number | undefined; // Adjust the type according to your config values
}

function setupMockConfig(keysAndValues: Record<string, string>) {
  const mockConfig: FlexibleConfig = {};
  Object.keys(keysAndValues).forEach((key) => {
    mockConfig[key] = keysAndValues[key];
  });

  jest.spyOn(Config, 'getConfig').mockReturnValue(mockConfig as any);
  jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResult());
}

describe('paypal-payment.service', () => {
  const mockServer = setupServer();
  const opts: PaypalPaymentServiceOptions = {
    ctCartService: paymentSDK.ctCartService,
    ctPaymentService: paymentSDK.ctPaymentService,
  };
  const paymentService: AbstractPaymentService = new PaypalPaymentService(opts);

  beforeAll(() => {
    mockServer.listen({
      onUnhandledRequest: 'bypass',
    });
  });

  beforeEach(() => {
    jest.setTimeout(10000);
    jest.resetAllMocks();
  });

  afterAll(() => {
    mockServer.close();
  });

  afterEach(() => {
    // jest.restoreAllMocks();
    mockServer.resetHandlers();
  });

  test('getConfig', async () => {
    // Setup mock config for a system using `clientKey`
    setupMockConfig({ paypalClientId: '', paypalEnvironment: 'test' });

    const result: ConfigResponse = await paymentService.config();

    // Assertions can remain the same or be adapted based on the abstracted access
    expect(result?.clientId).toStrictEqual('');
    expect(result?.environment).toStrictEqual('test');
  });

  test('getSupportedPaymentComponents', async () => {
    const result = await paymentService.getSupportedPaymentComponents();
    expect(result?.components).toHaveLength(1);
    expect(result?.components[0]?.type).toStrictEqual('paypal');
  });

  test('getStatus', async () => {
    const mockHealthCheckFunction: () => Promise<HealthCheckResult> = async () => {
      const result: HealthCheckResult = {
        name: 'CoCo Permissions',
        status: 'DOWN',
        details: {},
      };
      return result;
    };

    setupMockConfig({ paypalClientId: '', paypalEnvironment: 'test', healthCheckTimeout: '4444' });
    jest.spyOn(StatusHandler, 'healthCheckCommercetoolsPermissions').mockReturnValue(mockHealthCheckFunction);
    mockServer.use(
      mockPaypalRequest(PaypalBasePath.TEST, `${PaypalUrls.AUTHENTICATION}`, 200, paypalAuthenticationResponse),
      mockPaypalGetRequest(PaypalBasePath.TEST, `${PaypalUrls.HEALTH_CHECK}`, 200, {
        event_types: [],
      }),
    );
    const result: StatusResponse = await paymentService.status();

    expect(result?.status).toBeDefined();
    expect(result?.checks).toHaveLength(2);
    expect(result?.status).toStrictEqual('Partially Available');
    expect(result?.checks[0]?.name).toStrictEqual('CoCo Permissions');
    expect(result?.checks[0]?.status).toStrictEqual('DOWN');
    expect(result?.checks[0]?.details).toStrictEqual({});
    expect(result?.checks[1]?.name).toStrictEqual('Paypal Payment API');
    expect(result?.checks[1]?.status).toStrictEqual('UP');
    expect(result?.checks[1]?.details).toBeDefined();
  });

  test('createPayment', async () => {
    const createPaymentOpts: CreateOrderRequestDTO = {
      intent: Intent.CAPTURE,
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            user_action: 'PAY_NOW',
          },
        },
      },
    };

    // Given
    mockServer.use(
      mockPaypalRequest(PaypalBasePath.TEST, `${PaypalUrls.AUTHENTICATION}`, 200, paypalAuthenticationResponse),
      mockPaypalRequest(PaypalBasePath.TEST, `${PaypalUrls.ORDERS}`, 201, paypalCreateOrderOkResponse),
    );

    jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResult());
    jest.spyOn(DefaultCartService.prototype, 'getPaymentAmount').mockResolvedValue(mockGetPaymentAmount);

    jest.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(mockGetPaymentResult);
    jest.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(mockGetCartResult());
    jest.spyOn(FastifyContext, 'getProcessorUrlFromContext').mockReturnValue('http://127.0.0.1');

    jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockGetPaymentResult);
    const paypalPaymentService: PaypalPaymentService = new PaypalPaymentService(opts);

    const result = await paypalPaymentService.createPayment(createPaymentOpts);
    expect(result?.id).toStrictEqual(paypalCreateOrderOkResponse.id);
    expect(result?.paymentReference).toStrictEqual('123456');
  });

  describe('modifyPayment', () => {
    test('capturePayment', async () => {
      // Given
      const orderId = mockUpdatePaymentResult.interfaceId as string;
      const url = PaypalUrls.ORDERS_CAPTURE.replace(/{resourceId}/g, orderId);
      mockServer.use(
        mockPaypalRequest(PaypalBasePath.TEST, `${PaypalUrls.AUTHENTICATION}`, 200, paypalAuthenticationResponse),
        mockPaypalRequest(PaypalBasePath.TEST, url, 201, paypalCaptureOrderOkResponse),
      );

      const modifyPaymentOpts: ModifyPayment = {
        paymentId: 'dummy-paymentId',
        data: {
          actions: [
            {
              action: 'capturePayment',
              amount: {
                centAmount: 3000,
                currencyCode: 'EUR',
              },
            },
          ],
        },
      };

      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResult);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);

      const result = await paymentService.modifyPayment(modifyPaymentOpts);
      expect(result?.outcome).toStrictEqual('approved');
    });

    test('cancelPayment', async () => {
      // Given
      const modifyPaymentOpts: ModifyPayment = {
        paymentId: 'dummy-paymentId',
        data: {
          actions: [
            {
              action: 'cancelPayment',
            },
          ],
        },
      };

      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResult);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);

      const result = paymentService.modifyPayment(modifyPaymentOpts);
      expect(result).rejects.toThrow('operation not supported');
    });

    test('refundPayment', async () => {
      // Given
      const orderId = mockUpdatePaymentResult.transactions[0].interactionId as string;
      const url = PaypalUrls.ORDERS_REFUND.replace(/{resourceId}/g, orderId);

      mockServer.use(
        mockPaypalRequest(PaypalBasePath.TEST, `${PaypalUrls.AUTHENTICATION}`, 200, paypalAuthenticationResponse),
        mockPaypalRequest(PaypalBasePath.TEST, url, 200, paypalRefundOkResponse),
      );

      const modifyPaymentOpts: ModifyPayment = {
        paymentId: 'dummy-paymentId',
        data: {
          actions: [
            {
              action: 'refundPayment',
              amount: {
                centAmount: 3000,
                currencyCode: 'EUR',
              },
            },
          ],
        },
      };

      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResult);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);

      const result = await paymentService.modifyPayment(modifyPaymentOpts);
      expect(result?.outcome).toStrictEqual('approved');
    });
  });
});
