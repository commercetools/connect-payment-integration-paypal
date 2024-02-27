import {
  CommercetoolsCartService,
  CommercetoolsPaymentService,
  ErrorGeneral,
} from '@commercetools/connect-payments-sdk';
import {
  OrderRequestSchemaDTO,
  OrderResponseSchemaDTO,
  PaymentOutcome,
  OrderCaptureResponseSchemaDTO,
} from '../dtos/paypal-payment.dto';

import { getCartIdFromContext } from '../libs/fastify/context/context';
import { PaypalPaymentAPI } from './api/api';
import { Address, Cart, Money, Payment } from '@commercetools/platform-sdk';
import { CreateOrderRequest, PaypalShipping, parseAmount } from './types/paypal-api.type';
import { PaymentModificationStatus } from '../dtos/operations/payment-intents.dto';
import { randomUUID } from 'crypto';
import { OrderConfirmation } from './types/paypal-payment.type';

export type PaypalPaymentServiceOptions = {
  ctCartService: CommercetoolsCartService;
  ctPaymentService: CommercetoolsPaymentService;
};

export class PaypalPaymentService {
  private ctCartService: CommercetoolsCartService;
  private ctPaymentService: CommercetoolsPaymentService;
  private paypalClient: PaypalPaymentAPI;

  constructor(opts: PaypalPaymentServiceOptions) {
    this.ctCartService = opts.ctCartService;
    this.ctPaymentService = opts.ctPaymentService;
    this.paypalClient = new PaypalPaymentAPI();
  }

  public async createPayment(data: OrderRequestSchemaDTO): Promise<OrderResponseSchemaDTO> {
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

    // TODO: we need to remove dependency on this enum belonging to payment intents
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

  public async confirmPayment(opts: OrderConfirmation): Promise<OrderCaptureResponseSchemaDTO> {
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
      // TODO: create a new method in payment sdk for changing transaction stat. To be used in scenarios, where we expect the txn state to change,
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
    payload: OrderRequestSchemaDTO,
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
