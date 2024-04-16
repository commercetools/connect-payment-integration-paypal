import { http, HttpHandler, HttpResponse } from 'msw';

export const mockPaypalGetRequest = (basePath: string, uri: string, respCode: number, data?: any): HttpHandler => {
  return http.get(`${basePath}${uri}`, () => {
    if (respCode >= 299) {
      const errorData = {
        name: 'SOME_ERROR_NAME',
        message: 'an error occurred in paypal',
        debug_id: '12345678',
      };
      return new Response(objectToReadableStream(errorData), {
        headers: {
          'paypal-debug-id': '12345678',
        },
        status: respCode,
      });
    }
    return HttpResponse.json(data);
  });
};

export const mockPaypalRequest = (
  basePath: string,
  uri: string,
  respCode: number,
  data?: any,
  hasQueryParameter?: boolean,
): HttpHandler => {
  return http.post(`${basePath}${uri}`, ({ request }) => {
    if (hasQueryParameter) {
      const url = new URL(request.url);
      url.searchParams.set('grant_type', 'client_credentials');

      new Request(url, request);
    }

    if (respCode === 401) {
      const errorData = {
        error: 'invalid_client',
        error_description: 'Client Authentication failed',
      };
      return new Response(objectToReadableStream(errorData), {
        headers: {
          'paypal-debug-id': '12345678',
        },
        status: respCode,
      });
    }

    if (respCode >= 299) {
      const errorData = {
        name: 'SOME_ERROR_NAME',
        message: 'an error occurred in paypal',
        debug_id: '12345678',
      };
      return new Response(objectToReadableStream(errorData), {
        headers: {
          'paypal-debug-id': '12345678',
        },
        status: respCode,
      });
    }

    return HttpResponse.json(data);
  });
};

function objectToReadableStream(obj: any) {
  const jsonString = JSON.stringify(obj);
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(jsonString);

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(uint8Array);
      controller.close();
    },
  });

  return stream;
}
