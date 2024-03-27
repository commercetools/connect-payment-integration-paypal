import { BaseOptions } from "../components/base";
import { PaypalBuilder } from "../components/payment-methods/paypal/paypal";
import { loadScript } from "@paypal/paypal-js";
import { EnablerOptions, PaymentEnabler } from "./payment-enabler";

export class PaypalPaymentEnabler implements PaymentEnabler {
  setupData: Promise<{ baseOptions: BaseOptions }>;

  constructor(options: EnablerOptions) {
    this.setupData = PaypalPaymentEnabler._Setup(options);
  }

  private static _Setup = async (
    options: EnablerOptions
  ): Promise<{ baseOptions: BaseOptions }> => {
    const configResponse = await fetch(
      options.processorUrl + "/operations/config",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": options.sessionId,
        },
      }
    );

    // TODO: handle not 2xx response
    const configJson = await configResponse.json();

    const paypalCheckout = await loadScript({
      clientId: configJson.clientId,
      disableFunding: [
        "paylater",
        "card",
        "venmo",
        "credit",
        "giropay",
        "sofort",
        "sepa",
      ],
      currency: configJson.currency
    });

    return {
      baseOptions: {
        sdk: paypalCheckout,
        processorUrl: options.processorUrl,
        sessionId: options.sessionId,
        onComplete: options.onComplete,
        onError: options.onError
      },
    };
  };

  async createComponentBuilder(type: string) {
    const setupData = await this.setupData;
    if (!setupData) {
      throw new Error("PaypalPaymentEnabler not initialized");
    }
    const supportedMethods = {
      paypal: PaypalBuilder,
    };

    if (!Object.keys(supportedMethods).includes(type)) {
      throw new Error(
        `Component type not supported: ${type}. Supported types: ${Object.keys(
          supportedMethods
        ).join(", ")}`
      );
    }
    return new supportedMethods[type](setupData.baseOptions);
  }
}
