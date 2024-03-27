import { BaseOptions } from "../components/base";
import { PaypalBuilder } from "../components/payment-methods/paypal/paypal";
import { loadScript } from "@paypal/paypal-js";
import {
  EnablerOptions,
  PaymentEnabler,
  PaymentResult,
} from "./payment-enabler";

export class PaypalPaymentEnabler implements PaymentEnabler {
  setupData: Promise<{ baseOptions: BaseOptions }>;

  constructor(options: EnablerOptions) {
    this.setupData = PaypalPaymentEnabler._Setup(options);
  }

  // Default handlers
  private static onError = (_: any) => {
    throw new Error('something went wrong.')
  };

  private static onComplete = (result: PaymentResult) => {
    console.log("onSubmit", result);
  };

  private static _Setup = async (
    options: EnablerOptions
  ): Promise<{ baseOptions: BaseOptions }> => {
    try {
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

      if (!configResponse.ok) {
        throw new Error('PaypalPaymentEnabler failed to fetch config')
      }

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
        currency: configJson.currency,
      });

      return {
        baseOptions: {
          sdk: paypalCheckout,
          processorUrl: options.processorUrl,
          sessionId: options.sessionId,
          onComplete: options.onComplete ? options.onComplete : this.onComplete,
          onError: options.onError ? options.onError : this.onError,
        },
      };
    } catch (e) {
      options.onError && options.onError(e);
      throw new Error("PaypalPaymentEnabler sdk setup failed");
    }
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
