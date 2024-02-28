import { http, HttpHandler, HttpResponse } from 'msw';

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

    new HttpResponse(null, {
      headers: {
        'paypal-debug-id': '12345678',
      },
      status: respCode,
    });
    if (respCode >= 299) {
      return HttpResponse.json(null, {
        status: respCode,
      });
    }
    return HttpResponse.json(data);
  });
};
