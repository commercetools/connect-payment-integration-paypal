import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  paypalAuthenticationResponse,
  paypalAuthenticationClientErrorResponse,
  paypalCaptureOrderOkResponse,
  paypalNotFoundResponse,
  paypalCreateOrderOkResponse,
  paypalRefundOkResponse,
} from './testdata/paypalResponses';
import { paypalCreateOrderRequest } from './testdata/paypalRequests';
import nock from 'nock';
import { PaypalPaymentAPI } from './api';
import { PaymentModificationStatus } from '../../dtos/operations/payment-intents.dto';
import { PaypalBasePath, PaypalUrls } from '../types/paypal-api.type';

describe('Paypal API', () => {
  const api = new PaypalPaymentAPI();

  beforeEach(() => {
    jest.setTimeout(10000);
    resetTestLibs();
  });

  describe('Paypal Authorization', () => {
    it('should return paypal authorization response', async () => {
      // Given
      mockPaypalRequest(
        PaypalBasePath.TEST,
        `${PaypalUrls.AUTHENTICATION}?grant_type=client_credentials`,
        200,
        paypalAuthenticationResponse,
      );

      // when
      const result = await api.authenticateRequest();

      // then
      expect(result.status).toBe(200);
      expect(result.accessToken).toBe('A21AAFEpH4PsADK7qSS7pSRsgz');
    });

    it('should return paypal error, if client id and secret are wrong', async () => {
      // Given
      mockPaypalRequest(
        PaypalBasePath.TEST,
        `${PaypalUrls.AUTHENTICATION}?grant_type=client_credentials`,
        401,
        paypalAuthenticationClientErrorResponse,
      );

      // when
      const result = api.authenticateRequest();

      // then
      await expect(result).rejects.toThrow('Error while authenticating with connector');
    });
  });

  describe('Create PayPal Order', () => {
    it('should create the order', async () => {
      // Given
      mockPaypalRequest(
        PaypalBasePath.TEST,
        `${PaypalUrls.AUTHENTICATION}?grant_type=client_credentials`,
        200,
        paypalAuthenticationResponse,
      );

      mockPaypalRequest(PaypalBasePath.TEST, PaypalUrls.ORDERS, 200, paypalCreateOrderOkResponse);

      // when
      const result = await api.createOrder(paypalCreateOrderRequest);

      // then
      expect(result.outcome).toBe(PaymentModificationStatus.APPROVED);
      expect(result.pspReference).toBe(paypalCreateOrderOkResponse.id);
    });
  });
  describe('Capture PayPal Order', () => {
    it('should capture the order', async () => {
      // Given
      const orderId = paypalCaptureOrderOkResponse.id;
      mockPaypalRequest(
        PaypalBasePath.TEST,
        `${PaypalUrls.AUTHENTICATION}?grant_type=client_credentials`,
        200,
        paypalAuthenticationResponse,
      );

      const url = PaypalUrls.ORDERS_CAPTURE.replace(/{resourceId}/g, orderId);
      mockPaypalRequest(PaypalBasePath.TEST, url, 200, paypalCaptureOrderOkResponse);

      // when
      const result = await api.captureOrder(orderId);

      // then
      expect(result.outcome).toBe(PaymentModificationStatus.APPROVED);
      expect(result.pspReference).toBe(paypalCaptureOrderOkResponse.purchase_units[0].payments.captures[0].id);
    });

    it('should return an error when PayPal return a not found order', async () => {
      // Given
      const orderId = paypalCaptureOrderOkResponse.id;
      mockPaypalRequest(
        PaypalBasePath.TEST,
        `${PaypalUrls.AUTHENTICATION}?grant_type=client_credentials`,
        200,
        paypalAuthenticationResponse,
      );

      const url = PaypalUrls.ORDERS_CAPTURE.replace(/{resourceId}/g, orderId);
      mockPaypalRequest(PaypalBasePath.TEST, url, 404, paypalNotFoundResponse);

      // when
      const result = api.captureOrder(orderId);

      // then
      await expect(result).rejects.toThrow('not able to capture the paypal order');
    });
  });

  describe('Refund Paypal Payment', () => {
    it('should perform a partial refund on the captured order', async () => {
      const captureId = paypalCaptureOrderOkResponse.purchase_units[0].payments.captures[0].id;
      mockPaypalRequest(
        PaypalBasePath.TEST,
        `${PaypalUrls.AUTHENTICATION}?grant_type=client_credentials`,
        200,
        paypalAuthenticationResponse,
      );

      const url = PaypalUrls.ORDERS_REFUND.replace(/{resourceId}/g, captureId);
      mockPaypalRequest(PaypalBasePath.TEST, url, 200, paypalRefundOkResponse);

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
      mockPaypalRequest(
        PaypalBasePath.TEST,
        `${PaypalUrls.AUTHENTICATION}?grant_type=client_credentials`,
        200,
        paypalAuthenticationResponse,
      );

      const url = PaypalUrls.ORDERS_REFUND.replace(/{resourceId}/g, captureId);
      mockPaypalRequest(PaypalBasePath.TEST, url, 200, paypalRefundOkResponse);

      // when
      const result = await api.refundFullPayment(captureId);

      // then
      expect(result.outcome).toBe(PaymentModificationStatus.APPROVED);
      expect(result.pspReference).toBe(paypalRefundOkResponse.id);
    });

    it('should return an error when PayPal return a not found error', async () => {
      // Given
      const captureId = paypalCaptureOrderOkResponse.purchase_units[0].payments.captures[0].id;
      mockPaypalRequest(
        PaypalBasePath.TEST,
        `${PaypalUrls.AUTHENTICATION}?grant_type=client_credentials`,
        200,
        paypalAuthenticationResponse,
      );

      const url = PaypalUrls.ORDERS_CAPTURE.replace(/{resourceId}/g, captureId);
      mockPaypalRequest(PaypalBasePath.TEST, url, 404, paypalNotFoundResponse);

      // when
      const result = api.refundFullPayment(captureId);

      // then
      await expect(result).rejects.toThrow('not able to fully refund a payment');
    });
  });
});

const resetTestLibs = () => {
  jest.resetAllMocks();
  nock.cleanAll();
  nock.enableNetConnect();
};

const mockPaypalRequest = (basePath: string, uri: string, respCode: number, data?: nock.Body) => {
  nock(basePath)
    .defaultReplyHeaders({
      'paypal-debug-id': '12345678',
    })
    .post(uri)
    .reply(respCode, data);
};
