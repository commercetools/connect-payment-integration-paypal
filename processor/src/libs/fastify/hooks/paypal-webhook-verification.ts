import { PaypalAPI } from '../../../clients/paypal.client';
import { FastifyRequest } from 'fastify';
import { ErrorAuthErrorResponse } from '@commercetools/connect-payments-sdk';
import { NotificationPayloadDTO } from '../../../dtos/paypal-payment.dto';
import { IncomingHttpHeaders } from 'http';
import { config } from '../../../config/config';

export class WebhookVerificationHook {
  paypalClient: PaypalAPI;
  constructor() {
    this.paypalClient = new PaypalAPI();
  }

  public authenticate() {
    return async (request: FastifyRequest) => {
      const data = request.body as NotificationPayloadDTO;
      if (!data.resource) {
        throw new ErrorAuthErrorResponse('Unexpected payload');
      }

      const verifyNotificationPayload = {
        auth_algo: this.verifyHeader(request.headers, 'paypal-auth-algo'),
        cert_url: this.verifyHeader(request.headers, 'paypal-cert-url'),
        transmission_id: this.verifyHeader(request.headers, 'paypal-transmission-id'),
        transmission_sig: this.verifyHeader(request.headers, 'paypal-transmission-sig'),
        transmission_time: this.verifyHeader(request.headers, 'paypal-transmission-time'),
        webhook_id: config.paypalWebhookId,
        webhook_event: data,
      };

      const validator = await this.paypalClient.verifyNotification(verifyNotificationPayload);
      if (validator.verification_status === 'FAILURE') {
        throw new ErrorAuthErrorResponse('Webhook signature is not valid');
      }
    };
  }

  private verifyHeader(headers: IncomingHttpHeaders, key: string): string {
    const value = headers[key];

    if (!value || Array.isArray(value)) {
      throw new Error('Could not retrieve correct header');
    }

    return value;
  }
}
