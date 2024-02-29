import {
  CommercetoolsCartService,
  CommercetoolsPaymentService,
  ErrorGeneral,
  healthCheckCommercetoolsPermissions,
  statusHandler,
} from '@commercetools/connect-payments-sdk';
import {
  CreateOrderRequestDTO,
  CreateOrderResponseDTO,
  CaptureOrderResponseDTO,
  PaymentOutcome,
} from '../dtos/paypal-payment.dto';

import { getCartIdFromContext } from '../libs/fastify/context/context';
import { PaypalAPI } from '../clients/paypal.client';
import { Address, Cart, Money, Payment } from '@commercetools/platform-sdk';
import { CreateOrderRequest, PaypalShipping, parseAmount } from './types/paypal-api.type';
import { PaymentModificationStatus } from '../dtos/operations/payment-intents.dto';
import { randomUUID } from 'crypto';
import { OrderConfirmation } from './types/paypal-payment.type';
import { getConfig } from '../config/config';
import {
  CancelPaymentRequest,
  CapturePaymentRequest,
  ConfigResponse,
  PaymentProviderModificationResponse,
  RefundPaymentRequest,
  StatusResponse,
} from './types/operation.type';
import { paymentSDK } from '../payment-sdk';
import { SupportedPaymentComponentsSchemaDTO } from '../dtos/operations/payment-componets.dto';
import { AbstractPaymentService } from './abstract-payment.service';
const packageJSON = require('../../package.json');

export type PaypalPaymentServiceOptions = {
  ctCartService: CommercetoolsCartService;
  ctPaymentService: CommercetoolsPaymentService;
};

export class PaypalPaymentService extends AbstractPaymentService {
  private paypalClient: PaypalAPI;

  constructor(opts: PaypalPaymentServiceOptions) {
    super(opts.ctCartService, opts.ctPaymentService);
    this.paypalClient = new PaypalAPI();
  }

  async config(): Promise<ConfigResponse> {
    return {
      clientId: getConfig().paypalClientId,
      environment: getConfig().paypalEnvironment,
    };
  }

  async status(): Promise<StatusResponse> {
    const handler = await statusHandler({
      timeout: getConfig().healthCheckTimeout,
      checks: [
        healthCheckCommercetoolsPermissions({
          requiredPermissions: ['manage_project', 'manage_checkout_payment_intents'],
          ctAuthorizationService: paymentSDK.ctAuthorizationService,
          projectKey: getConfig().projectKey,
        }),
        async () => {
          try {
            const healthCheck = await this.paypalClient.healthCheck();
            if (healthCheck?.status === 200) {
              const paymentMethods = 'paypal';
              return {
                name: 'Paypal Payment API',
                status: 'UP',
                details: {
                  paymentMethods,
                },
              };
            } else {
              throw new Error(healthCheck?.statusText);
            }
          } catch (e) {
            return {
              name: 'Paypal Payment API',
              status: 'DOWN',
              details: {
                // TODO do not expose the error
                error: (e as Error)?.message,
              },
            };
          }
        },
      ],
      metadataFn: async () => ({
        name: packageJSON.name,
        description: packageJSON.description,
        '@commercetools/sdk-client-v2': packageJSON.dependencies['@commercetools/sdk-client-v2'],
      }),
    })();

    return handler.body;
  }

  public async getSupportedPaymentComponents(): Promise<SupportedPaymentComponentsSchemaDTO> {
    return {
      components: [
        {
          type: 'paypal',
        },
      ],
    };
  }

  public async createPayment(data: CreateOrderRequestDTO): Promise<CreateOrderResponseDTO> {
    const ctCart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });
    const amountPlanned = await this.ctCartService.getPaymentAmount({
      cart: ctCart,
    });

    const ctPayment = await this.ctPaymentService.createPayment({
      amountPlanned,
      paymentMethodInfo: {
        paymentInterface: 'paypal',
      },
      ...(ctCart.customerId && {
        customer: {
          typeId: 'customer',
          id: ctCart.customerId,
        },
      }),
    });

    await this.ctCartService.addPayment({
      resource: {
        id: ctCart.id,
        version: ctCart.version,
      },
      paymentId: ctPayment.id,
    });

    // Make call to paypal to create payment intent
    const paypalRequestData = this.convertCreatePaymentIntentRequest(ctCart, amountPlanned, data);
    const paypalResponse = await this.paypalClient.createOrder(paypalRequestData);

    const isAuthorized = paypalResponse.outcome === PaymentModificationStatus.APPROVED;

    const resultCode = isAuthorized ? PaymentOutcome.AUTHORIZED : PaymentOutcome.REJECTED;

    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference: paypalResponse.pspReference,
      paymentMethod: 'paypal',
      transaction: {
        type: 'Authorization',
        amount: ctPayment.amountPlanned,
        interactionId: paypalResponse.pspReference,
        state: this.convertPaymentResultCode(resultCode as PaymentOutcome),
      },
    });

    return {
      id: paypalResponse.pspReference,
      paymentReference: updatedPayment.id,
    };
  }

  public async confirmPayment(opts: OrderConfirmation): Promise<CaptureOrderResponseDTO> {
    const ctPayment = await this.ctPaymentService.getPayment({
      id: opts.data.paymentReference,
    });

    this.validateInterfaceIdMismatch(ctPayment, opts.data.orderId);

    let updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      transaction: {
        type: 'Charge',
        amount: ctPayment.amountPlanned,
        state: 'Initial',
      },
    });

    try {
      // Make call to paypal to capture payment intent
      const paypalResponse = await this.paypalClient.captureOrder(opts.data.orderId);

      updatedPayment = await this.ctPaymentService.updatePayment({
        id: ctPayment.id,
        transaction: {
          type: 'Charge',
          amount: ctPayment.amountPlanned,
          interactionId: paypalResponse.pspReference,
          state: paypalResponse.outcome === PaymentModificationStatus.APPROVED ? 'Success' : 'Failure',
        },
      });

      return {
        id: paypalResponse.pspReference,
        paymentReference: updatedPayment.id,
      };
    } catch (e) {
      // TODO: create a new method in payment sdk for changing transaction state. To be used in scenarios, where we expect the txn state to change,
      // from initial, to success to failure https://docs.commercetools.com/api/projects/payments#change-transactionstate
      await this.ctPaymentService.updatePayment({
        id: ctPayment.id,
        transaction: {
          type: 'Charge',
          amount: ctPayment.amountPlanned,
          state: 'Failure',
        },
      });

      throw e;
    }
  }

  async capturePayment(request: CapturePaymentRequest): Promise<PaymentProviderModificationResponse> {
    return await this.paypalClient.captureOrder(request.payment.interfaceId);
  }

  async cancelPayment(request: CancelPaymentRequest): Promise<PaymentProviderModificationResponse> {
    throw new ErrorGeneral('operation not supported', {
      fields: {
        pspReference: request.payment.interfaceId,
      },
      privateMessage: "connector doesn't support cancel operation",
    });
  }

  async refundPayment(request: RefundPaymentRequest): Promise<PaymentProviderModificationResponse> {
    const transaction = request.payment.transactions.find((t) => t.type === 'Charge' && t.state === 'Success');
    const captureId = transaction?.interactionId;
    if (this.isPartialRefund(request)) {
      return this.paypalClient.refundPartialPayment(captureId, request.amount);
    }

    return this.paypalClient.refundFullPayment(captureId);
  }

  private isPartialRefund(request: RefundPaymentRequest): boolean {
    return request.payment.amountPlanned.centAmount > request.amount.centAmount;
  }

  private validateInterfaceIdMismatch(payment: Payment, orderId: string) {
    if (payment.interfaceId !== orderId) {
      throw new ErrorGeneral('not able to confirm the payment', {
        fields: {
          cocoError: 'interface id mismatch',
          pspReference: orderId,
          paymentReference: payment.id,
        },
      });
    }
  }

  private convertPaymentResultCode(resultCode: PaymentOutcome): string {
    switch (resultCode) {
      case PaymentOutcome.AUTHORIZED:
        return 'Success';
      case PaymentOutcome.REJECTED:
        return 'Failure';
      default:
        return 'Initial';
    }
  }

  private convertCreatePaymentIntentRequest(
    cart: Cart,
    amount: Money,
    payload: CreateOrderRequestDTO,
  ): CreateOrderRequest {
    return {
      ...payload,
      purchase_units: [
        {
          reference_id: 'ct-connect-paypal-' + randomUUID(),
          invoice_id: cart.id,
          amount: {
            currency_code: amount.currencyCode,
            value: parseAmount(amount.centAmount),
          },
          shipping: this.convertShippingAddress(cart.shippingAddress),
        },
      ],
    };
  }

  private convertShippingAddress(shippingAddress: Address | undefined): PaypalShipping {
    return {
      type: 'SHIPPING',
      name: {
        full_name: this.getFullName(shippingAddress?.firstName, shippingAddress?.lastName),
      },
      address: {
        postal_code: shippingAddress?.postalCode,
        country_code: shippingAddress?.country || '',
        address_line_1: this.getAddressLine(shippingAddress?.streetName, shippingAddress?.streetNumber),
        address_line_2: shippingAddress?.additionalStreetInfo,
        admin_area_1: shippingAddress?.state || shippingAddress?.region || '',
        admin_area_2: shippingAddress?.city,
      },
    };
  }

  private getFullName(firstName: string | undefined, lastName: string | undefined): string {
    let fullName = '';

    if (firstName) {
      fullName = firstName;
    }

    if (lastName) {
      if (fullName.length > 0) {
        fullName = `${fullName} ${lastName}`;
      } else {
        fullName = lastName;
      }
    }

    return fullName;
  }

  private getAddressLine(streetName: string | undefined, streetNumber: string | undefined): string {
    let addressLine = '';

    if (streetName) {
      addressLine = streetName;
    }

    if (streetNumber) {
      if (addressLine.length > 0) {
        addressLine = `${addressLine} ${streetNumber}`;
      } else {
        addressLine = streetNumber;
      }
    }

    return addressLine;
  }
}
