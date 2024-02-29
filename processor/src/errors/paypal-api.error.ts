import { Errorx, ErrorxAdditionalOpts } from '@commercetools/connect-payments-sdk';

export type PaypalApiErrorData = {
  status: number;
  name: string;
  message: string;
  debug_id?: string | null;
};

export class PaypalApiError extends Errorx {
  constructor(errorData: PaypalApiErrorData, additionalOpts?: ErrorxAdditionalOpts) {
    super({
      code: `PaypalError-${errorData.name}`,
      httpErrorStatus: errorData.status,
      message: errorData.message,
      ...additionalOpts,
    });
  }
}
