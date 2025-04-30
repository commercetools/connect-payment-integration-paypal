import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  paypalAuthenticationResponse,
  paypalAuthenticationClientErrorResponse,
  paypalCaptureOrderOkResponse,
  paypalNotFoundResponse,
  paypalCreateOrderOkResponse,
  paypalRefundOkResponse,
  paypalErrorResponse,
  paypalGetOrderOkResponse,
} from './utils/mock-paypal-response-data';
import { paypalCreateOrderRequest } from './utils/mock-paypal-request-data';
import { setupServer } from 'msw/node';
import { PaypalAPI } from '../src/clients/paypal.client';
import { mockPaypalGetRequest, mockPaypalRequest } from './utils/paypal-request.mock';
import { OrderStatus, PaypalBasePath, PaypalUrls } from '../src/clients/types/paypal.client.type';
import { PartialRefundPayload } from '../src/services/converters/partial-refund.converter';

describe('Paypal API', () => {
  const api = new PaypalAPI();
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
      await expect(result).rejects.toThrow('Client Authentication failed');
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
      expect(result?.status).toBe(OrderStatus.PAYER_ACTION_REQUIRED);
      expect(result?.id).toBe(paypalCreateOrderOkResponse.id);
    });

    it('should return paypal error, if error occurs via paypal', async () => {
      // Given

      mockServer.use(
        mockPaypalRequest(PaypalBasePath.TEST, `${PaypalUrls.AUTHENTICATION}`, 200, paypalAuthenticationResponse),
        mockPaypalRequest(PaypalBasePath.TEST, PaypalUrls.ORDERS, 299, paypalErrorResponse),
      );

      // when
      const result = api.createOrder(paypalCreateOrderRequest);

      // then
      expect(result).rejects.toThrow();
    });
  });

  describe('Get PayPal Order', () => {
    it('should fetch an order', async () => {
      // Given
      const orderId = paypalCaptureOrderOkResponse.id;
      const url = PaypalUrls.GET_ORDERS.replace(/{resourceId}/g, orderId);
      mockServer.use(
        mockPaypalRequest(PaypalBasePath.TEST, `${PaypalUrls.AUTHENTICATION}`, 200, paypalAuthenticationResponse),
        mockPaypalGetRequest(PaypalBasePath.TEST, url, 200, paypalGetOrderOkResponse),
      );

      // when
      const result = await api.getOrder(orderId);

      // then
      expect(result?.id).toBe(paypalGetOrderOkResponse.id);
      expect(result.purchase_units).toMatchObject(paypalGetOrderOkResponse.purchase_units);
    });

    it('should return an error when PayPal return a not found order', async () => {
      // Given
      const orderId = paypalCaptureOrderOkResponse.id;
      const url = PaypalUrls.GET_ORDERS.replace(/{resourceId}/g, orderId);
      mockServer.use(
        mockPaypalRequest(PaypalBasePath.TEST, `${PaypalUrls.AUTHENTICATION}`, 200, paypalAuthenticationResponse),
        mockPaypalGetRequest(PaypalBasePath.TEST, url, 404, paypalGetOrderOkResponse),
      );

      // when
      const result = api.getOrder(orderId);

      // then
      await expect(result).rejects.toThrow('an error occurred in paypal');
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
      expect(result.status).toBe(OrderStatus.COMPLETED);
      expect(result.id).toBe(paypalCaptureOrderOkResponse.id);
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
      await expect(result).rejects.toThrow('an error occurred in paypal');
    });
  });

  describe('Refund Paypal Payment', () => {
    it('should perform a partial refund on the captured order', async () => {
      const captureId = paypalCaptureOrderOkResponse.purchase_units[0].payments.captures[0].id;
      const url = PaypalUrls.ORDERS_REFUND.replace(/{resourceId}/g, captureId);
      const refundDetailsURL = PaypalUrls.GET_REFUND.replace(/{resourceId}/g, paypalRefundOkResponse.id);

      mockServer.use(
        mockPaypalRequest(PaypalBasePath.TEST, `${PaypalUrls.AUTHENTICATION}`, 200, paypalAuthenticationResponse),
        mockPaypalRequest(PaypalBasePath.TEST, url, 200, paypalRefundOkResponse),
        mockPaypalGetRequest(PaypalBasePath.TEST, refundDetailsURL, 200, paypalRefundOkResponse),
      );

      const requestPayload: PartialRefundPayload = {
        amount: {
          currency_code: 'USD',
          value: '10.00',
        },
      };

      // when
      const result = await api.refundPartialPayment(captureId, requestPayload);

      // then
      expect(result.status).toBe(OrderStatus.COMPLETED);
      expect(result.id).toBe(paypalRefundOkResponse.id);
      expect(result.amount).toEqual({ value: '10.00', currency_code: 'USD' });
    });

    it('should perform a full refund on the captured order', async () => {
      const captureId = paypalCaptureOrderOkResponse.purchase_units[0].payments.captures[0].id;
      const url = PaypalUrls.ORDERS_REFUND.replace(/{resourceId}/g, captureId);
      const refundDetailsURL = PaypalUrls.GET_REFUND.replace(/{resourceId}/g, paypalRefundOkResponse.id);

      mockServer.use(
        mockPaypalRequest(PaypalBasePath.TEST, `${PaypalUrls.AUTHENTICATION}`, 200, paypalAuthenticationResponse),
        mockPaypalRequest(PaypalBasePath.TEST, url, 200, paypalRefundOkResponse),
        mockPaypalGetRequest(PaypalBasePath.TEST, refundDetailsURL, 200, paypalRefundOkResponse),
      );

      // when
      const result = await api.refundFullPayment(captureId);

      // then
      expect(result.status).toBe(OrderStatus.COMPLETED);
      expect(result.id).toBe(paypalRefundOkResponse.id);
    });

    it('should return an error when PayPal return a not found error', async () => {
      // Given
      const captureId = paypalCaptureOrderOkResponse.purchase_units[0].payments.captures[0].id;
      const url = PaypalUrls.ORDERS_REFUND.replace(/{resourceId}/g, captureId);
      mockServer.use(
        mockPaypalRequest(PaypalBasePath.TEST, `${PaypalUrls.AUTHENTICATION}`, 200, paypalAuthenticationResponse),
        mockPaypalRequest(PaypalBasePath.TEST, url, 404, paypalNotFoundResponse),
      );

      // when
      const result = api.refundFullPayment(captureId);

      // then
      await expect(result).rejects.toThrow('an error occurred in paypal');
    });
  });
});

const resetTestLibs = () => {
  jest.resetAllMocks();
};
