import { describe, test, expect, afterEach, jest, afterAll, beforeAll, beforeEach } from '@jest/globals';
import { ConfigResponse, ModifyPayment } from '../src/services/types/operation.type';

import { paymentSDK } from '../src/payment-sdk';
import { DefaultPaymentService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment.service';
import { mockGetPaymentResult, mockUpdatePaymentResult } from './utils/mock-payment-data';
import * as Config from '../src/config/config';
import { PaypalPaymentServiceOptions } from '../src/services/types/paypal-payment.type';
import { AbstractPaymentService } from '../src/services/abstract-payment.service';
import { PaypalPaymentService } from '../src/services/paypal-payment.service';
import { setupServer } from 'msw/node';
import { PaypalUrls, PaypalBasePath } from '../src/clients/types/paypal.client.type';
import { paypalAuthenticationResponse, paypalCaptureOrderOkResponse } from './utils/mock-paypal-response-data';
import { mockPaypalRequest } from './utils/paypal-request.mock';

interface FlexibleConfig {
  [key: string]: string | number | undefined; // Adjust the type according to your config values
}

function setupMockConfig(keysAndValues: Record<string, string>) {
  const mockConfig: FlexibleConfig = {};
  Object.keys(keysAndValues).forEach((key) => {
    mockConfig[key] = keysAndValues[key];
  });

  jest.spyOn(Config, 'getConfig').mockReturnValue(mockConfig as any);
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

    // const opService: OperationService = new DefaultOperationService(opts);
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

  test('modifyPayment', async () => {
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
});
