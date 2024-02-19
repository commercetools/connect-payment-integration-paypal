import { config } from '../../config/config';
import { log } from '../../libs/logger';
import { AuthenticationResponse, IPaypalPaymentAPI, PaypalBasePath, PaypalUrls } from '../types/paypal-api.type';
import axios, { AxiosError, AxiosResponse } from 'axios';

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
          Authorization: `Bearer ${auth?.accessToken}`,
        },
      };

      return await axios(options);
    } catch (e) {
      this.handleError(e as AxiosError);
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

  private async authenticateRequest(): Promise<AuthenticationResponse | undefined> {
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
      this.handleError(e as AxiosError);
    }
  }

  private handleError(e: AxiosError) {
    // TODO: improve error handling
    log.error(e);
    throw e;
  }
}
