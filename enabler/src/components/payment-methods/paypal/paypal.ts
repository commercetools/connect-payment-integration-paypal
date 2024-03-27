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
      onClick: async (_, actions) => {
        if (!this.componentOptions.onClick()) {
          return actions.reject()
        } 
        return actions.resolve()
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
          const data = await response.json();
          if (data.id) {
            return data.id;
          }

          const errorDetail = data?.errors?.[0]?.details?.[0];
          const errorMessage = errorDetail
            ? `${errorDetail?.issue} ${errorDetail?.description} (${data?.debug_id})`
            : JSON.stringify(data);

          throw new Error(errorMessage);
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

          const orderData = await response.json();
          const errorDetail = orderData?.errors?.[0]?.details?.[0];
          const errorMessage = errorDetail
            ? `${errorDetail?.issue} ${errorDetail?.description} (${orderData?.debug_id})`
            : JSON.stringify(orderData);

          if (errorDetail?.issue === "INSTRUMENT_DECLINED" && actions) {
            return actions.restart();
          } else if (errorDetail || orderData?.captureStatus === "DECLINED") {
            throw new Error(errorMessage);
          } else {
            this.baseOptions.onComplete({
              paymentReference: orderData?.paymentReference,
              isSuccess: orderData?.captureStatus === "COMPLETED",
            });
          }
        } catch (err) {
          this.baseOptions.onError(err);
        }
      },
    });
  }
}
