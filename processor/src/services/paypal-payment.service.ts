import { ErrorGeneral, healthCheckCommercetoolsPermissions, statusHandler } from '@commercetools/connect-payments-sdk';
import {
  CreateOrderRequestDTO,
  CreateOrderResponseDTO,
  CaptureOrderResponseDTO,
  NotificationPayloadDTO,
} from '../dtos/paypal-payment.dto';

import { getCartIdFromContext, getPaymentInterfaceFromContext } from '../libs/fastify/context/context';
import { PaypalAPI } from '../clients/paypal.client';
import { Address, Cart, Money, Payment } from '@commercetools/platform-sdk';
import {
  CaptureOrderResponse,
  CreateOrderRequest,
  OrderStatus,
  PaypalShipping,
  parseAmount,
} from '../clients/types/paypal.client.type';
import { PaymentModificationStatus } from '../dtos/operations/payment-intents.dto';
import { randomUUID } from 'crypto';
import {
  TransactionStates,
  OrderConfirmation,
  PaymentOutcome,
  PaypalPaymentServiceOptions,
  TransactionTypes,
} from './types/paypal-payment.type';
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
import { NotificationConverter } from './converters/notification.converter';
const packageJSON = require('../../package.json');

export class PaypalPaymentService extends AbstractPaymentService {
  private paypalClient: PaypalAPI;
  private notificationConverter: NotificationConverter;

  constructor(opts: PaypalPaymentServiceOptions) {
    super(opts.ctCartService, opts.ctPaymentService);
    this.paypalClient = new PaypalAPI();
    this.notificationConverter = new NotificationConverter();
  }

  /**
   * Get configurations
   *
   * @remarks
   * Implementation to provide mocking configuration information
   *
   * @returns Promise with mocking object containing configuration information
   */
  async config(): Promise<ConfigResponse> {
    return {
      clientId: getConfig().paypalClientId,
      environment: getConfig().paypalEnvironment,
    };
  }

  /**
   * Get status
   *
   * @remarks
   * Implementation to provide mocking status of external systems
   *
   * @returns Promise with mocking data containing a list of status from different external systems
   */
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

  /**
   * Get supported payment components
   *
   * @remarks
   * Implementation to provide the mocking payment components supported by the processor.
   *
   * @returns Promise with mocking data containing a list of supported payment components
   */
  public async getSupportedPaymentComponents(): Promise<SupportedPaymentComponentsSchemaDTO> {
    return {
      components: [
        {
          type: 'paypal',
        },
      ],
    };
  }

  /**
   * Create payment
   *
   * @remarks
   * Implementation to provide the mocking data for payment creation in external PSPs
   *
   * @param request - contains amount and {@link https://docs.commercetools.com/api/projects/payments | Payment } defined in composable commerce
   * @returns Promise with mocking data containing order id and PSP reference
   */
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
        paymentInterface: getPaymentInterfaceFromContext() || 'paypal',
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
    const paypalRequestData = this.convertCreatePaymentIntentRequest(ctCart, ctPayment, amountPlanned, data);
    const paypalResponse = await this.paypalClient.createOrder(paypalRequestData);

    const isAuthorized = paypalResponse.status === OrderStatus.PAYER_ACTION_REQUIRED;

    const resultCode = isAuthorized ? PaymentOutcome.AUTHORIZED : PaymentOutcome.REJECTED;

    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference: paypalResponse.id,
      paymentMethod: 'paypal',
      transaction: {
        type: 'Authorization',
        amount: ctPayment.amountPlanned,
        interactionId: paypalResponse.id,
        state: this.convertPaymentResultCode(resultCode as PaymentOutcome),
      },
    });

    return {
      id: paypalResponse.id,
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
        type: TransactionTypes.CHARGE,
        amount: ctPayment.amountPlanned,
        state: TransactionStates.INITIAL,
      },
    });

    try {
      // Make call to paypal to capture payment intent
      const paypalResponse = await this.paypalClient.captureOrder(opts.data.orderId);
      const convertedResponse = this.convertCaptureOrderResponse(paypalResponse, updatedPayment.id);

      updatedPayment = await this.ctPaymentService.updatePayment({
        id: updatedPayment.id,
        transaction: {
          type: TransactionTypes.CHARGE,
          amount: updatedPayment.amountPlanned,
          interactionId: convertedResponse.id,
          state:
            paypalResponse.status === OrderStatus.COMPLETED ? TransactionStates.SUCCESS : TransactionStates.FAILURE,
        },
      });

      return convertedResponse;
    } catch (e) {
      // TODO: create a new method in payment sdk for changing transaction state. To be used in scenarios, where we expect the txn state to change,
      // from initial, to success to failure https://docs.commercetools.com/api/projects/payments#change-transactionstate
      await this.ctPaymentService.updatePayment({
        id: ctPayment.id,
        transaction: {
          type: TransactionTypes.CHARGE,
          amount: ctPayment.amountPlanned,
          state: TransactionStates.FAILURE,
        },
      });

      throw e;
    }
  }

  public async processNotification(opts: { data: NotificationPayloadDTO }): Promise<void> {
    const updateData = await this.notificationConverter.convert(opts.data);
    await this.ctPaymentService.updatePayment(updateData);
  }

  /**
   * Capture payment
   *
   * @remarks
   * Implementation to provide the mocking data for payment capture in external PSPs
   *
   * @param request - contains the amount and {@link https://docs.commercetools.com/api/projects/payments | Payment } defined in composable commerce
   * @returns Promise with mocking data containing operation status and PSP reference
   */
  async capturePayment(request: CapturePaymentRequest): Promise<PaymentProviderModificationResponse> {
    const data = await this.paypalClient.captureOrder(request.payment.interfaceId);
    const response = this.convertCaptureOrderResponse(data, request.payment.id);

    return {
      outcome:
        data.status === OrderStatus.COMPLETED ? PaymentModificationStatus.APPROVED : PaymentModificationStatus.REJECTED,
      pspReference: response.id,
    };
  }

  /**
   * Cancel payment
   *
   * @remarks
   * Implementation to provide the mocking data for payment cancel in external PSPs
   *
   * @param request - contains {@link https://docs.commercetools.com/api/projects/payments | Payment } defined in composable commerce
   * @returns Promise with mocking data containing operation status and PSP reference
   */
  async cancelPayment(request: CancelPaymentRequest): Promise<PaymentProviderModificationResponse> {
    throw new ErrorGeneral('operation not supported', {
      fields: {
        pspReference: request.payment.interfaceId,
      },
      privateMessage: "connector doesn't support cancel operation",
    });
  }

  /**
   * Refund payment
   *
   * @remarks
   * Implementation to provide the mocking data for payment refund in external PSPs
   *
   * @param request - contains amount and {@link https://docs.commercetools.com/api/projects/payments | Payment } defined in composable commerce
   * @returns Promise with mocking data containing operation status and PSP reference
   */
  async refundPayment(request: RefundPaymentRequest): Promise<PaymentProviderModificationResponse> {
    const transaction = request.payment.transactions.find(
      (t) => t.type === TransactionTypes.CHARGE && t.state === TransactionStates.SUCCESS,
    );
    const captureId = transaction?.interactionId;
    if (this.isPartialRefund(request)) {
      const data = await this.paypalClient.refundPartialPayment(captureId, request.amount);
      return {
        outcome:
          data.status === OrderStatus.COMPLETED
            ? PaymentModificationStatus.APPROVED
            : PaymentModificationStatus.REJECTED,
        pspReference: data.id,
      };
    }

    const data = await this.paypalClient.refundFullPayment(captureId);
    return {
      outcome:
        data.status === OrderStatus.COMPLETED ? PaymentModificationStatus.APPROVED : PaymentModificationStatus.REJECTED,
      pspReference: data.id,
    };
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
        return TransactionStates.SUCCESS;
      case PaymentOutcome.REJECTED:
        return TransactionStates.FAILURE;
      default:
        return TransactionStates.INITIAL;
    }
  }

  private convertCreatePaymentIntentRequest(
    cart: Cart,
    payment: Payment,
    amount: Money,
    payload: CreateOrderRequestDTO,
  ): CreateOrderRequest {
    return {
      ...payload,
      purchase_units: [
        {
          reference_id: 'ct-connect-paypal-' + randomUUID(),
          invoice_id: payment.id,
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

  private convertCaptureOrderResponse(data: CaptureOrderResponse, paymentId: string): CaptureOrderResponseDTO {
    const capture = this.extractCaptureIdAndStatus(data);
    return {
      captureStatus: capture.status,
      id: capture.id,
      paymentReference: paymentId,
    };
  }

  private extractCaptureIdAndStatus(data: CaptureOrderResponse): any {
    if (
      data.purchase_units &&
      data.purchase_units.length > 0 &&
      data.purchase_units[0]?.payments?.captures &&
      data.purchase_units[0]?.payments?.captures.length > 0 &&
      data.purchase_units[0]?.payments?.captures[0]
    ) {
      return data.purchase_units[0].payments.captures[0];
    } else {
      throw new ErrorGeneral(undefined, {
        privateMessage: 'not able to extract the capture ID/Status',
      });
    }
  }

  // private convertCaptureOrderStatus(data: any): PaymentModificationStatus {
  //   if (data?.status) {
  //     const result = data.status as string;
  //     if (result.toUpperCase() === 'COMPLETED') {
  //       return PaymentModificationStatus.APPROVED;
  //     } else {
  //       return PaymentModificationStatus.REJECTED;
  //     }
  //   } else {
  //     throw new ErrorGeneral(undefined, {
  //       privateMessage: 'capture status not received.',
  //     });
  //   }
  // }
}
