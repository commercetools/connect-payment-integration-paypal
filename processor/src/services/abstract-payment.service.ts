import {
  CommercetoolsCartService,
  CommercetoolsPaymentService,
  ErrorInvalidOperation,
} from '@commercetools/connect-payments-sdk';
import {
  CancelPaymentRequest,
  CapturePaymentRequest,
  ConfigResponse,
  ModifyPayment,
  PaymentProviderModificationResponse,
  RefundPaymentRequest,
  ReversePaymentRequest,
  StatusResponse,
} from './types/operation.type';

import { SupportedPaymentComponentsSchemaDTO } from '../dtos/operations/payment-componets.dto';
import { log } from '../libs/logger';
import { PaymentIntentResponseSchemaDTO } from '../dtos/operations/payment-intents.dto';

export abstract class AbstractPaymentService {
  protected ctCartService: CommercetoolsCartService;
  protected ctPaymentService: CommercetoolsPaymentService;

  protected constructor(ctCartService: CommercetoolsCartService, ctPaymentService: CommercetoolsPaymentService) {
    this.ctCartService = ctCartService;
    this.ctPaymentService = ctPaymentService;
  }

  /**
   * Get configurations
   *
   * @remarks
   * Abstract method to get configuration information
   *
   * @returns Promise with object containing configuration information
   */
  abstract config(): Promise<ConfigResponse>;

  /**
   * Get status
   *
   * @remarks
   * Abstract method to get status of external systems
   *
   * @returns Promise with a list of status from different external systems
   */
  abstract status(): Promise<StatusResponse>;

  /**
   * Get supported payment components
   *
   * @remarks
   * Abstract method to fetch the supported payment components by the processor. The actual invocation should be implemented in subclasses
   *
   * @returns Promise with a list of supported payment components
   */
  abstract getSupportedPaymentComponents(): Promise<SupportedPaymentComponentsSchemaDTO>;

  /**
   * Capture payment
   *
   * @remarks
   * Abstract method to execute payment capture in external PSPs. The actual invocation to PSPs should be implemented in subclasses
   *
   * @param request - contains the amount and {@link https://docs.commercetools.com/api/projects/payments | Payment } defined in composable commerce
   * @returns Promise with the outcome containing operation status and PSP reference
   */
  abstract capturePayment(request: CapturePaymentRequest): Promise<PaymentProviderModificationResponse>;

  /**
   * Cancel payment
   *
   * @remarks
   * Abstract method to execute payment cancel in external PSPs. The actual invocation to PSPs should be implemented in subclasses
   *
   * @param request - contains {@link https://docs.commercetools.com/api/projects/payments | Payment } defined in composable commerce
   * @returns Promise with outcome containing operation status and PSP reference
   */
  abstract cancelPayment(request: CancelPaymentRequest): Promise<PaymentProviderModificationResponse>;

  /**
   * Refund payment
   *
   * @remarks
   * Abstract method to execute payment refund in external PSPs. The actual invocation to PSPs should be implemented in subclasses
   *
   * @param request
   * @returns Promise with outcome containing operation status and PSP reference
   */
  abstract refundPayment(request: RefundPaymentRequest): Promise<PaymentProviderModificationResponse>;

  /**
   * Modify payment
   *
   * @remarks
   * This method is used to execute Capture/Cancel/Refund payment in external PSPs and update composable commerce. The actual invocation to PSPs should be implemented in subclasses
   *
   * @param opts - input for payment modification including payment ID, action and payment amount
   * @returns Promise with outcome of payment modification after invocation to PSPs
   */

  abstract refundPayment(request: RefundPaymentRequest): Promise<PaymentProviderModificationResponse>;

  /**
   * Reverse payment
   *
   * @remarks
   * Abstract method to execute payment reversals in support of automated reversals to be triggered by checkout api. The actual invocation to PSPs should be implemented in subclasses
   *
   * @param request
   * @returns Promise with outcome containing operation status and PSP reference
   */
  abstract reversePayment(request: ReversePaymentRequest): Promise<PaymentProviderModificationResponse>;

  /**
   * Modify payment
   *
   * @remarks
   * This method is used to execute Capture/Cancel/Refund payment in external PSPs and update composable commerce. The actual invocation to PSPs should be implemented in subclasses
   *
   * @param opts - input for payment modification including payment ID, action and payment amount
   * @returns Promise with outcome of payment modification after invocation to PSPs
   */
  public async modifyPayment(opts: ModifyPayment): Promise<PaymentIntentResponseSchemaDTO> {
    const ctPayment = await this.ctPaymentService.getPayment({
      id: opts.paymentId,
    });

    const request = opts.data.actions[0];

    switch (request.action) {
      case 'cancelPayment': {
        return await this.cancelPayment({
          payment: ctPayment,
          merchantReference: request.merchantReference,
        });
      }
      case 'capturePayment': {
        return await this.capturePayment({
          payment: ctPayment,
          merchantReference: request.merchantReference,
          amount: request.amount,
        });
      }
      case 'refundPayment': {
        return await this.refundPayment({
          amount: request.amount,
          payment: ctPayment,
          merchantReference: request.merchantReference,
          transactionId: request.transactionId,
        });
      }
      case 'reversePayment': {
        return await this.reversePayment({
          payment: ctPayment,
          merchantReference: request.merchantReference,
        });
      }
      default: {
        log.error(`Operation not supported when modifying payment.`);
        throw new ErrorInvalidOperation(`Operation not supported.`);
      }
    }

    // const updatedPayment = await this.ctPaymentService.updatePayment({
    //   id: ctPayment.id,
    //   transaction: {
    //     type: transactionType,
    //     amount: requestAmount,
    //     state: 'Initial',
    //   },
    // });
    // const res = await this.processPaymentModification(
    //   updatedPayment,
    //   transactionType,
    //   requestAmount,
    //   request.merchantReference,
    // );

    // await this.ctPaymentService.updatePayment({
    //   id: ctPayment.id,
    //   transaction: {
    //     type: transactionType,
    //     amount: requestAmount,
    //     interactionId: res.pspReference,
    //     state: res.outcome === PaymentModificationStatus.APPROVED ? 'Success' : 'Failure',
    //   },
    // });

    // return {
    //   outcome: res.outcome,
    //   paymentReference: ctPayment.id,
    // };
  }
}
