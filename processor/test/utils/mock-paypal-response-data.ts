export const paypalAuthenticationResponse = {
  scope:
    'https://uri.paypal.com/services/invoicing https://uri.paypal.com/services/disputes/read-buyer https://uri.paypal.com/services/payments/realtimepayment https://uri.paypal.com/services/disputes/update-seller https://uri.paypal.com/services/payments/payment/authcapture openid https://uri.paypal.com/services/disputes/read-seller https://uri.paypal.com/services/payments/refund https://api-m.paypal.com/v1/vault/credit-card https://api-m.paypal.com/v1/payments/.* https://uri.paypal.com/payments/payouts https://api-m.paypal.com/v1/vault/credit-card/.* https://uri.paypal.com/services/subscriptions https://uri.paypal.com/services/applications/webhooks',
  access_token: 'A21AAFEpH4PsADK7qSS7pSRsgz',
  token_type: 'Bearer',
  app_id: 'APP-80W284485P519543T',
  expires_in: 31668,
  nonce: '2020-04-03T15:35:36ZaYZlGvEkV4yVSz8g6bAKFoGSEzuy3CQcz3ljhibkOHg',
};

export const paypalAuthenticationClientErrorResponse = {
  status: 401,
  statusText: 'Unauthorized',
  headers: {
    connection: 'close',
    'content-length': '77',
    'content-type': 'application/json',
    server: 'nginx',
    'cache-control': 'max-age=0, no-cache, no-store, must-revalidate',
    'paypal-debug-id': 'e17ac21f0bf54',
    pragma: 'no-cache',
    'x-paypal-token-service': 'IAAS',
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'edge-control': 'max-age=0',
    'accept-ranges': 'bytes',
    date: 'Tue, 18 Jul 2023 14:58:01 GMT',
    via: '1.1 varnish',
    'x-served-by': 'cache-fra-etou8220067-FRA',
    'x-cache': 'MISS',
    'x-cache-hits': '0',
    'x-timer': 'S1689692281.964920,VS0,VE265',
  },
  config: {
    transformRequest: [Array],
    transformResponse: [Array],
    timeout: 0,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    maxContentLength: -1,
    maxBodyLength: -1,
  },
  data: {
    error: 'invalid_client',
    error_description: 'Client Authentication failed',
  },
};

export const paypalCreateOrderOkResponse = {
  id: '2WJ067824R598984A',
  status: 'PAYER_ACTION_REQUIRED',
  payment_source: {
    paypal: {},
  },
  links: [
    {
      href: 'https://api.sandbox.paypal.com/v2/checkout/orders/2WJ067824R598984A',
      rel: 'self',
      method: 'GET',
    },
    {
      href: 'https://www.sandbox.paypal.com/checkoutnow?token=2WJ067824R598984A',
      rel: 'payer-action',
      method: 'GET',
    },
  ],
};

export const paypalRefundOkResponse = {
  id: '1JU08902781691411',
  amount: {
    value: '10.00',
    currency_code: 'USD',
  },
  status: 'COMPLETED',
  note: 'Defective product',
  seller_payable_breakdown: {
    gross_amount: {
      value: '10.00',
      currency_code: 'USD',
    },
    paypal_fee: {
      value: '0',
      currency_code: 'USD',
    },
    platform_fees: [
      {
        amount: {
          currency_code: 'USD',
          value: '1.00',
        },
      },
    ],
    net_amount: {
      value: '9.00',
      currency_code: 'USD',
    },
    total_refunded_amount: {
      value: '10.00',
      currency_code: 'USD',
    },
  },
  invoice_id: 'INVOICE-123',
  create_time: '2022-04-23T23:24:19Z',
  update_time: '2022-04-23T23:24:19Z',
  links: [
    {
      rel: 'self',
      method: 'GET',
      href: 'https://api.paypal.com/v2/payments/refunds/1JU08902781691411',
    },
    {
      rel: 'up',
      method: 'GET',
      href: 'https://api.paypal.com/v2/payments/captures/2GG279541U471931P',
    },
  ],
};

export const paypalCaptureOrderOkResponse = {
  id: '92C12661DS923781G',
  status: 'COMPLETED',
  payment_source: {
    paypal: {
      email_address: 'sb-gg8ym25350581@personal.example.com',
      account_id: '5QDH9X52LNBCQ',
      account_status: 'VERIFIED',
      name: {
        given_name: 'client',
        surname: 'test',
      },
      address: {
        country_code: 'DE',
      },
    },
  },
  purchase_units: [
    {
      reference_id: 'test-david',
      shipping: {
        name: {
          full_name: 'client test',
        },
        address: {
          address_line_1: 'Badensche Str. 24',
          admin_area_2: 'Berlin',
          admin_area_1: 'Berlin',
          postal_code: '10715',
          country_code: 'DE',
        },
      },
      payments: {
        captures: [
          {
            id: '0CK67015SC9955729',
            status: 'COMPLETED',
            amount: {
              currency_code: 'EUR',
              value: '50.00',
            },
            final_capture: true,
            seller_protection: {
              status: 'ELIGIBLE',
              dispute_categories: ['ITEM_NOT_RECEIVED', 'UNAUTHORIZED_TRANSACTION'],
            },
            seller_receivable_breakdown: {
              gross_amount: {
                currency_code: 'EUR',
                value: '50.00',
              },
              paypal_fee: {
                currency_code: 'EUR',
                value: '2.89',
              },
              net_amount: {
                currency_code: 'EUR',
                value: '47.11',
              },
            },
            links: [
              {
                href: 'https://api.sandbox.paypal.com/v2/payments/captures/0CK67015SC9955729',
                rel: 'self',
                method: 'GET',
              },
              {
                href: 'https://api.sandbox.paypal.com/v2/payments/captures/0CK67015SC9955729/refund',
                rel: 'refund',
                method: 'POST',
              },
              {
                href: 'https://api.sandbox.paypal.com/v2/checkout/orders/92C12661DS923781G',
                rel: 'up',
                method: 'GET',
              },
            ],
            create_time: '2023-07-24T12:51:41Z',
            update_time: '2023-07-24T12:51:41Z',
          },
        ],
      },
    },
  ],
  payer: {
    name: {
      given_name: 'client',
      surname: 'test',
    },
    email_address: 'sb-gg8ym25350581@personal.example.com',
    payer_id: '5QDH9X52LNBCQ',
    address: {
      country_code: 'DE',
    },
  },
  links: [
    {
      href: 'https://api.sandbox.paypal.com/v2/checkout/orders/92C12661DS923781G',
      rel: 'self',
      method: 'GET',
    },
  ],
};

export const paypalNotFoundResponse = {
  name: 'RESOURCE_NOT_FOUND',
  details: [
    {
      issue: 'INVALID_RESOURCE_ID',
      description: 'Specified resource ID does not exist. Please check the resource ID and try again.',
    },
  ],
  message: 'The specified resource does not exist.',
  debug_id: 'f45fd701f132e',
  links: [
    {
      href: 'https://developer.paypal.com/docs/api/orders/v2/#error-INVALID_RESOURCE_ID',
      rel: 'information_link',
      method: 'GET',
    },
  ],
};

export const paypalErrorResponse = {
  status: 299,
  statusText: 'Unprocessable Entity',
  headers: {
    connection: 'close',
    'content-length': '77',
    'content-type': 'application/json',
    server: 'nginx',
    'cache-control': 'max-age=0, no-cache, no-store, must-revalidate',
    'paypal-debug-id': 'e17ac21f0bf54',
    pragma: 'no-cache',
    'x-paypal-token-service': 'IAAS',
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'edge-control': 'max-age=0',
    'accept-ranges': 'bytes',
    date: 'Tue, 18 Jul 2023 14:58:01 GMT',
    via: '1.1 varnish',
    'x-served-by': 'cache-fra-etou8220067-FRA',
    'x-cache': 'MISS',
    'x-cache-hits': '0',
    'x-timer': 'S1689692281.964920,VS0,VE265',
  },
  config: {
    transformRequest: [Array],
    transformResponse: [Array],
    timeout: 0,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    maxContentLength: -1,
    maxBodyLength: -1,
  },
  data: {
    error: 'Some entity Error',
    error_description: 'Business validation error',
  },
};

export const paypalGetOrderOkResponse = {
  id: '5O190127TN364715T',
  status: 'APPROVED',
  intent: 'CAPTURE',
  payment_source: {
    paypal: {
      name: {
        given_name: 'John',
        surname: 'Doe',
      },
      email_address: 'customer@example.com',
      account_id: 'QYR5Z8XDVJNXQ',
    },
  },
  purchase_units: [
    {
      reference_id: 'd9f80740-38f0-11e8-b467-0ed5f89f718b',
      amount: {
        currency_code: 'USD',
        value: '100.00',
      },
    },
  ],
  payer: {
    name: {
      given_name: 'John',
      surname: 'Doe',
    },
    email_address: 'customer@example.com',
    payer_id: 'QYR5Z8XDVJNXQ',
  },
  create_time: '2018-04-01T21:18:49Z',
  links: [
    {
      href: 'https://api-m.paypal.com/v2/checkout/orders/5O190127TN364715T',
      rel: 'self',
      method: 'GET',
    },
    {
      href: 'https://www.paypal.com/checkoutnow?token=5O190127TN364715T',
      rel: 'approve',
      method: 'GET',
    },
    {
      href: 'https://api-m.paypal.com/v2/checkout/orders/5O190127TN364715T',
      rel: 'update',
      method: 'PATCH',
    },
    {
      href: 'https://api-m.paypal.com/v2/checkout/orders/5O190127TN364715T/capture',
      rel: 'capture',
      method: 'POST',
    },
  ],
};
