import {
  CommercetoolsCartService,
  CommercetoolsPaymentService,
  ErrorGeneral,
} from '@commercetools/connect-payments-sdk';
import { PaymentConfirmRequestSchemaDTO, PaymentOutcome, PaymentResponseSchemaDTO } from '../dtos/paypal-payment.dto';

import { getCartIdFromContext } from '../libs/fastify/context/context';
import { ConfirmPayment, CreatePayment } from './types/paypal-payment.type';
import { PaypalPaymentAPI } from './api/api';
import { Address, Cart, Money, Payment } from '@commercetools/platform-sdk';
import { CreateOrderRequest, PaypalShipping, parseAmount } from './types/paypal-api.type';
import { PaymentIntentResponseSchemaDTO, PaymentModificationStatus } from '../dtos/operations/payment-intents.dto';
import { randomUUID } from 'crypto';

export type PaypalPaymentServiceOptions = {
  ctCartService: CommercetoolsCartService;
  ctPaymentService: CommercetoolsPaymentService;
};

export class PaypalPaymentService {
  private ctCartService: CommercetoolsCartService;
  private ctPaymentService: CommercetoolsPaymentService;
  // private allowedCreditCards = ['4111111111111111', '5555555555554444', '341925950237632'];
  private paypalClient: PaypalPaymentAPI;

  constructor(opts: PaypalPaymentServiceOptions) {
    this.ctCartService = opts.ctCartService;
    this.ctPaymentService = opts.ctPaymentService;
    this.paypalClient = new PaypalPaymentAPI();
  }

  // private isCreditCardAllowed(cardNumber: string) {
  //   return this.allowedCreditCards.includes(cardNumber);
  // }

  public async createPayment(opts: CreatePayment): Promise<PaymentResponseSchemaDTO> {
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

    const paymentMethod = opts.data.paymentMethod;

    // Make call to paypal to create payment intent
    const paypalRequestData = this.convertCreatePaymentIntentRequest(ctCart, amountPlanned);
    const paypalResponse = await this.paypalClient.createOrder(paypalRequestData);

    const isAuthorized = paypalResponse.outcome === PaymentModificationStatus.APPROVED;

    const resultCode = isAuthorized ? PaymentOutcome.AUTHORIZED : PaymentOutcome.REJECTED;

    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference: paypalResponse.pspReference,
      paymentMethod: paymentMethod.type,
      transaction: {
        type: 'Authorization',
        amount: ctPayment.amountPlanned,
        interactionId: paypalResponse.pspReference,
        state: this.convertPaymentResultCode(resultCode as PaymentOutcome),
      },
    });

    return {
      outcome: resultCode,
      paymentReference: updatedPayment.id,
    };
  }

  public async confirmPayment(opts: ConfirmPayment): Promise<PaymentIntentResponseSchemaDTO> {
    const ctPayment = await this.ctPaymentService.getPayment({
      id: opts.data.details.paymentReference,
    });

    this.validateInterfaceIdMismatch(ctPayment, opts.data);

    let updatedPayment = await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      transaction: {
        type: 'Charge',
        amount: ctPayment.amountPlanned,
        state: 'Initial',
      },
    });

    try {
      // Make call to paypal to create payment intent
      const paypalResponse = await this.paypalClient.captureOrder(opts.data.details.pspReference);

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
        outcome: paypalResponse.outcome,
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

  private validateInterfaceIdMismatch(payment: Payment, data: PaymentConfirmRequestSchemaDTO) {
    if (payment.interfaceId !== data.details?.pspReference) {
      throw new ErrorGeneral('not able to confirm the payment', {
        fields: {
          cocoError: 'interface id mismatch',
          pspReference: data.details?.pspReference,
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

  private convertCreatePaymentIntentRequest(cart: Cart, amount: Money): CreateOrderRequest {
    return {
      intent: 'CAPTURE',
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
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            user_action: 'PAY_NOW',
          },
        },
      },
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
