import {
  ComponentOptions,
  PaymentComponent,
  PaymentMethod,
} from "../../../payment-enabler/payment-enabler";
import {
  PaypalBaseComponentBuilder,
  BaseOptions,
  DefaultPaypalComponent,
} from "../../base";

export class PaypalBuilder extends PaypalBaseComponentBuilder {
  public componentHasSubmit = false;

  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.paypal, baseOptions);
  }

  build(config: ComponentOptions): PaymentComponent {
    const paypalComponent = new PaypalComponent(
      this.paymentMethod,
      this.baseOptions,
      config
    );
    paypalComponent.init();
    return paypalComponent;
  }
}

export class PaypalComponent extends DefaultPaypalComponent {
  constructor(
    paymentMethod: PaymentMethod,
    baseOptions: BaseOptions,
    componentOptions: ComponentOptions
  ) {
    super(paymentMethod, baseOptions, componentOptions);
  }

  init() {
    this.component = this.baseOptions.sdk.Buttons({
      style: {
        height: 40,
        label: "buynow",
      },
      onClick: async (_, actions) => {
        if (!this.componentOptions.onClick()) {
          return actions.reject();
        }
        return actions.resolve();
      },
      onCancel: () => {
        this.baseOptions.onError("Payment cancelled by user");
      },
      onError: (err) => {
        this.baseOptions.onError(err);
      },
      createOrder: async (): Promise<string> => {
        try {
          const response = await fetch(
            this.baseOptions.processorUrl + "/checkout/orders",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Session-Id": this.baseOptions.sessionId,
              },
              body: JSON.stringify({
                intent: "CAPTURE",
                payment_source: {
                  paypal: {
                    experience_context: {
                      payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
                      user_action: "PAY_NOW",
                    },
                  },
                },
              }),
            }
          );

          if (!response.ok) {
            const error = await response.json().catch(() => ({})); // Graceful handling if JSON parsing fails
            const debugId =  error?.errors?.[0]?.debug_id
            const errorDetail = error?.errors?.[0]?.details?.[0];
            const errorMessage = errorDetail
              ? `${errorDetail?.issue} ${errorDetail?.description} (${debugId})`
              : JSON.stringify(error);

            throw new Error(errorMessage);
          }

          const data = await response.json().catch(() => {
            throw new Error("Failed to parse response JSON");
          });

          if (data.id) {
            return data.id;
          }
        } catch (err) {
          this.baseOptions.onError(err);
        }
      },
      onApprove: async (data, actions): Promise<void> => {
        try {
          const response = await fetch(
            `${this.baseOptions.processorUrl}/checkout/orders/${data.orderID}/capture`,
            {
              method: "POST",
              headers: {
                "X-Session-Id": this.baseOptions.sessionId,
              },
            }
          );

          if (!response.ok) {
            const error = await response.json().catch(() => ({})); // Graceful handling if JSON parsing fails

            const errorDetail = error?.errors?.[0]?.details?.[0];
            const debugId =  error?.errors?.[0]?.debug_id
            const errorMessage = errorDetail
              ? `${errorDetail?.issue} ${errorDetail?.description} (${debugId})`
              : JSON.stringify(error);

            if (errorDetail?.issue === "INSTRUMENT_DECLINED" && actions) {
              return actions.restart();
            }

            throw new Error(errorMessage);
          }

          const orderData = await response.json().catch(() => {
            throw new Error("Failed to parse response JSON");
          });

          if (orderData?.captureStatus === "DECLINED") {
            throw new Error("payment declined");
          }

          this.baseOptions.onComplete({
            paymentReference: orderData?.paymentReference,
            isSuccess: orderData?.captureStatus === "COMPLETED",
          });
        } catch (err) {
          this.baseOptions.onError(err);
        }
      },
    });
  }
}
