import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  paypalAuthenticationResponse,
  paypalAuthenticationClientErrorResponse,
  paypalCaptureOrderOkResponse,
  paypalNotFoundResponse,
  paypalCreateOrderOkResponse,
  paypalRefundOkResponse,
} from './utils/mock-paypal-response-data';
import { paypalCreateOrderRequest } from './utils/mock-paypal-request-data';
import { setupServer } from 'msw/node';
import { PaypalPaymentAPI } from '../src/services/api/api';
import { PaymentModificationStatus } from '../src/dtos/operations/payment-intents.dto';
import { PaypalBasePath, PaypalUrls } from '../src/services/types/paypal-api.type';
import { mockPaypalRequest } from './utils/paypal-request.mock';

describe('Paypal API', () => {
  const api = new PaypalPaymentAPI();
  const mockServer = setupServer();

  beforeAll(() => {
    mockServer.listen({
      onUnhandledRequest: 'bypass',
    });
  });

  beforeEach(() => {
    jest.setTimeout(10000);
    resetTestLibs();
  });

  afterEach(() => {
    mockServer.resetHandlers();
  });

  afterAll(() => {
    mockServer.close();
  });

  describe('Paypal Authorization', () => {
    it('should return paypal authorization response', async () => {
      // Given
      mockServer.use(
        mockPaypalRequest(PaypalBasePath.TEST, `${PaypalUrls.AUTHENTICATION}`, 200, paypalAuthenticationResponse),
      );

      // when
      const result = await api.authenticateRequest();

      // then
      expect(result.status).toBe(200);
      expect(result.accessToken).toBe('A21AAFEpH4PsADK7qSS7pSRsgz');
    });

    it('should return paypal error, if client id and secret are wrong', async () => {
      // Given

      mockServer.use(
        mockPaypalRequest(
          PaypalBasePath.TEST,
          `${PaypalUrls.AUTHENTICATION}`,
          401,
          paypalAuthenticationClientErrorResponse,
        ),
      );

      // when
      const result = api.authenticateRequest();

      // then
      await expect(result).rejects.toThrow('Error while authenticating with payment provider.');
    });
  });

  describe('Create PayPal Order', () => {
    it('should create the order', async () => {
      // Given
      mockServer.use(
        mockPaypalRequest(PaypalBasePath.TEST, `${PaypalUrls.AUTHENTICATION}`, 200, paypalAuthenticationResponse),
        mockPaypalRequest(PaypalBasePath.TEST, PaypalUrls.ORDERS, 200, paypalCreateOrderOkResponse),
      );

      // when
      const result = await api.createOrder(paypalCreateOrderRequest);

      // then
      expect(result?.outcome).toBe(PaymentModificationStatus.APPROVED);
      expect(result?.pspReference).toBe(paypalCreateOrderOkResponse.id);
    });
  });
  describe('Capture PayPal Order', () => {
    it('should capture the order', async () => {
      // Given
      const orderId = paypalCaptureOrderOkResponse.id;
      const url = PaypalUrls.ORDERS_CAPTURE.replace(/{resourceId}/g, orderId);
      mockServer.use(
        mockPaypalRequest(PaypalBasePath.TEST, `${PaypalUrls.AUTHENTICATION}`, 200, paypalAuthenticationResponse),
        mockPaypalRequest(PaypalBasePath.TEST, url, 200, paypalCaptureOrderOkResponse),
      );

      // when
      const result = await api.captureOrder(orderId);

      // then
      expect(result.outcome).toBe(PaymentModificationStatus.APPROVED);
      expect(result.pspReference).toBe(paypalCaptureOrderOkResponse.purchase_units[0].payments.captures[0].id);
    });

    it('should return an error when PayPal return a not found order', async () => {
      // Given
      const orderId = paypalCaptureOrderOkResponse.id;
      const url = PaypalUrls.ORDERS_CAPTURE.replace(/{resourceId}/g, orderId);
      mockServer.use(
        mockPaypalRequest(PaypalBasePath.TEST, `${PaypalUrls.AUTHENTICATION}`, 200, paypalAuthenticationResponse),

        mockPaypalRequest(PaypalBasePath.TEST, url, 404, paypalNotFoundResponse),
      );

      // when
      const result = api.captureOrder(orderId);

      // then
      await expect(result).rejects.toThrow('not able to capture the paypal order');
    });
  });

  describe('Refund Paypal Payment', () => {
    it('should perform a partial refund on the captured order', async () => {
      const captureId = paypalCaptureOrderOkResponse.purchase_units[0].payments.captures[0].id;
      const url = PaypalUrls.ORDERS_REFUND.replace(/{resourceId}/g, captureId);
      mockServer.use(
        mockPaypalRequest(PaypalBasePath.TEST, `${PaypalUrls.AUTHENTICATION}`, 200, paypalAuthenticationResponse),

        mockPaypalRequest(PaypalBasePath.TEST, url, 200, paypalRefundOkResponse),
      );

      // when
      const result = await api.refundPartialPayment(captureId, {
        currencyCode: 'EUR',
        centAmount: 3000,
      });

      // then
      expect(result.outcome).toBe(PaymentModificationStatus.APPROVED);
      expect(result.pspReference).toBe(paypalRefundOkResponse.id);
    });

    it('should perform a full refund on the captured order', async () => {
      const captureId = paypalCaptureOrderOkResponse.purchase_units[0].payments.captures[0].id;
      const url = PaypalUrls.ORDERS_REFUND.replace(/{resourceId}/g, captureId);
      mockServer.use(
        mockPaypalRequest(PaypalBasePath.TEST, `${PaypalUrls.AUTHENTICATION}`, 200, paypalAuthenticationResponse),
        mockPaypalRequest(PaypalBasePath.TEST, url, 200, paypalRefundOkResponse),
      );

      // when
      const result = await api.refundFullPayment(captureId);

      // then
      expect(result.outcome).toBe(PaymentModificationStatus.APPROVED);
      expect(result.pspReference).toBe(paypalRefundOkResponse.id);
    });

    it('should return an error when PayPal return a not found error', async () => {
      // Given
      const captureId = paypalCaptureOrderOkResponse.purchase_units[0].payments.captures[0].id;
      const url = PaypalUrls.ORDERS_CAPTURE.replace(/{resourceId}/g, captureId);
      mockServer.use(
        mockPaypalRequest(PaypalBasePath.TEST, `${PaypalUrls.AUTHENTICATION}`, 200, paypalAuthenticationResponse),
        mockPaypalRequest(PaypalBasePath.TEST, url, 404, paypalNotFoundResponse),
      );

      // when
      const result = api.refundFullPayment(captureId);

      // then
      await expect(result).rejects.toThrow('not able to fully refund a payment');
    });
  });
});

const resetTestLibs = () => {
  jest.resetAllMocks();
};
