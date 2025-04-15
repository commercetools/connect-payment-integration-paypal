import {
  ErrorGeneral,
  healthCheckCommercetoolsPermissions,
  statusHandler,
  Address,
  Cart,
  Money,
  Payment,
  ErrorInvalidOperation,
} from '@commercetools/connect-payments-sdk';
import {
  CreateOrderRequestDTO,
  CreateOrderResponseDTO,
  CaptureOrderResponseDTO,
  NotificationPayloadDTO,
} from '../dtos/paypal-payment.dto';

import {
  getCartIdFromContext,
  getFutureOrderNumberFromContext,
  getPaymentInterfaceFromContext,
} from '../libs/fastify/context/context';
import { PaypalAPI } from '../clients/paypal.client';
import {
  Capture,
  CaptureOrderResponse,
  CreateOrderRequest,
  OrderStatus,
  PaypalShipping,
  RefundResponse,
} from '../clients/types/paypal.client.type';
import { AmountSchemaDTO, PaymentModificationStatus } from '../dtos/operations/payment-intents.dto';
import { randomUUID } from 'crypto';
import {
  TransactionStates,
  OrderConfirmation,
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
  ReversePaymentRequest,
  StatusResponse,
} from './types/operation.type';
import { paymentSDK } from '../payment-sdk';
import { SupportedPaymentComponentsSchemaDTO } from '../dtos/operations/payment-componets.dto';
import { AbstractPaymentService } from './abstract-payment.service';
import { NotificationConverter } from './converters/notification.converter';
import { log } from '../libs/logger';
import { convertCoCoAmountToPayPalAmount, convertPayPalAmountToCoCoAmount } from './converters/amount.converter';
import { PartialRefundConverter } from './converters/partial-refund.converter';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJSON = require('../../package.json');

export class PaypalPaymentService extends AbstractPaymentService {
  private paypalClient: PaypalAPI;
  private notificationConverter: NotificationConverter;
  private partialRefundConverter: PartialRefundConverter;

  constructor(opts: PaypalPaymentServiceOptions) {
    super(opts.ctCartService, opts.ctPaymentService);
    this.paypalClient = new PaypalAPI();
    this.notificationConverter = new NotificationConverter();
    this.partialRefundConverter = new PartialRefundConverter();
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
    const ctCart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });

    return {
      currency: ctCart.totalPrice.currencyCode,
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
          requiredPermissions: [
            'manage_payments',
            'view_sessions',
            'view_api_clients',
            'manage_orders',
            'introspect_oauth_tokens',
            'manage_checkout_payment_intents',
          ],
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
                error: e,
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
      log: log,
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
      ...(!ctCart.customerId &&
        ctCart.anonymousId && {
          anonymousId: ctCart.anonymousId,
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

    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference: paypalResponse.id,
      paymentMethod: 'paypal',
    });

    return {
      id: paypalResponse.id,
      paymentReference: updatedPayment.id,
    };
  }

  public async confirmPayment(opts: OrderConfirmation): Promise<CaptureOrderResponseDTO> {
    const order = await this.paypalClient.getOrder(opts.data.orderId);
    const ctPayment = await this.ctPaymentService.getPayment({
      id: order.purchase_units[0].invoice_id,
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
    const paymentId = opts.data.resource.invoice_id;
    const payment = await this.ctPaymentService.getPayment({
      id: paymentId,
    });

    const updateData = this.notificationConverter.convert(opts.data, payment.amountPlanned.fractionDigits);
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
    log.info(`Processing payment modification.`, {
      paymentId: request.payment.id,
      action: 'capturePayment',
    });

    const response = await this.processPaymentModificationInternal({
      request,
      transactionType: TransactionTypes.CHARGE,
      paypalOperation: 'capture',
      amount: request.amount,
    });

    log.info(`Payment modification completed.`, {
      paymentId: request.payment.id,
      action: 'capturePayment',
      result: response.outcome,
    });

    return response;
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
    log.info(`Processing payment modification.`, {
      paymentId: request.payment.id,
      action: 'refundPayment',
    });

    const response = await this.processPaymentModificationInternal({
      request,
      transactionType: TransactionTypes.REFUND,
      paypalOperation: 'refund',
      amount: request.amount,
    });

    log.info(`Payment modification completed.`, {
      paymentId: request.payment.id,
      action: 'refundPayment',
      result: response.outcome,
    });

    return response;
  }

  /**
   * Reverse payment
   *
   * @remarks
   * Implementation to provide the mocking data for payment refund in external PSPs
   *
   * @param request - contains {@link https://docs.commercetools.com/api/projects/payments | Payment } defined in composable commerce
   * @returns Promise with mocking data containing operation status and PSP reference
   */
  async reversePayment(request: ReversePaymentRequest): Promise<PaymentProviderModificationResponse> {
    log.info(`Processing payment modification.`, {
      paymentId: request.payment.id,
      action: 'reversePayment',
    });

    const response = await this.refundPayment({
      amount: request.payment.amountPlanned,
      merchantReference: request.merchantReference,
      payment: request.payment,
    });

    log.info(`Payment modification completed.`, {
      paymentId: request.payment.id,
      action: 'reversePayment',
      result: response.outcome,
    });

    return response;
  }

  private async processPaymentModificationInternal(opts: {
    request: CapturePaymentRequest | RefundPaymentRequest;
    transactionType: 'Charge' | 'Refund';
    paypalOperation: 'capture' | 'refund';
    amount: AmountSchemaDTO;
  }): Promise<PaymentProviderModificationResponse> {
    const { request, transactionType, paypalOperation, amount } = opts;

    const response = await this.makeCallToPaypalInternal(paypalOperation, request);

    await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: transactionType,
        amount: response?.amount
          ? convertPayPalAmountToCoCoAmount(response.amount, request.payment.amountPlanned.fractionDigits)
          : amount,
        interactionId: response.id,
        state: response.status === OrderStatus.COMPLETED ? TransactionStates.SUCCESS : TransactionStates.FAILURE,
      },
    });

    return {
      outcome:
        response.status === OrderStatus.COMPLETED
          ? PaymentModificationStatus.APPROVED
          : PaymentModificationStatus.REJECTED,
      pspReference: response.id,
    };
  }

  private async makeCallToPaypalInternal(
    paypalOperation: 'capture' | 'refund',
    request: CapturePaymentRequest | RefundPaymentRequest,
  ): Promise<RefundResponse | CaptureOrderResponse> {
    switch (paypalOperation) {
      case 'capture': {
        const data = await this.paypalClient.captureOrder(request.payment.interfaceId);
        const response = this.convertCaptureOrderResponse(data, request.payment.id);
        return {
          id: response.id,
          purchase_units: data.purchase_units,
          status: data.status,
        } as CaptureOrderResponse;
      }
      case 'refund': {
        const transaction = request.payment.transactions.find(
          (t) => t.type === TransactionTypes.CHARGE && t.state === TransactionStates.SUCCESS,
        );
        const captureId = transaction?.interactionId;
        if (this.isPartialRefund(request)) {
          return await this.paypalClient.refundPartialPayment(
            captureId,
            this.partialRefundConverter.convert(request as RefundPaymentRequest),
          );
        }
        return await this.paypalClient.refundFullPayment(captureId);
      }
      default: {
        log.error(`makeCallToPaypalInternal: Operation  ${paypalOperation} not supported when modifying payment.`);
        throw new ErrorInvalidOperation(`Operation not supported.`);
      }
    }
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

  private convertCreatePaymentIntentRequest(
    cart: Cart,
    payment: Payment,
    amount: Money,
    payload: CreateOrderRequestDTO,
  ): CreateOrderRequest {
    const futureOrderNumber = getFutureOrderNumberFromContext();
    const shippingAddress = paymentSDK.ctCartService.getOneShippingAddress({ cart });

    return {
      ...payload,
      purchase_units: [
        {
          reference_id: 'ct-connect-paypal-' + randomUUID(),
          invoice_id: payment.id,
          amount: {
            currency_code: amount.currencyCode,
            value: convertCoCoAmountToPayPalAmount(amount, payment.amountPlanned.fractionDigits),
          },
          shipping: this.convertShippingAddress(shippingAddress),
          ...(futureOrderNumber && { custom_id: futureOrderNumber }),
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

  private extractCaptureIdAndStatus(data: CaptureOrderResponse): Capture {
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
}
