import {
  PayPalButtonsComponent,
  PayPalButtonsComponentOptions,
  PayPalNamespace,
} from "@paypal/paypal-js";
import {
  ComponentOptions,
  PaymentComponent,
  PaymentComponentBuilder,
  PaymentMethod,
  PaymentResult,
} from "../payment-enabler/payment-enabler";

export type ElementOptions = {
  paymentMethod: PaymentMethod;
};

export type BaseOptions = {
  sdk: PayPalNamespace;
  processorUrl: string;
  sessionId: string;
  // The enabler always falls back to its own default handlers, so components
  // can rely on these being present.
  onComplete: (result: PaymentResult) => void;
  onError: (error: any) => void;
};

/**
 * Base Web Component
 */
export abstract class PaypalBaseComponentBuilder
  implements PaymentComponentBuilder
{
  public componentHasSubmit = false;

  protected paymentMethod: PaymentMethod;
  protected baseOptions: BaseOptions;

  constructor(paymentMethod: PaymentMethod, baseOptions: BaseOptions) {
    this.paymentMethod = paymentMethod;
    this.baseOptions = baseOptions;
  }

  build(config: ComponentOptions): PaymentComponent {
    const component = new DefaultPaypalComponent(
      this.paymentMethod,
      this.baseOptions,
      config
    );
    component.init();
    return component;
  }
}

export class DefaultPaypalComponent implements PaymentComponent {
  // Assigned in init(), which the builder calls immediately after construction.
  protected component!: PayPalButtonsComponent;
  protected paymentMethod: PaymentMethod;
  protected baseOptions: BaseOptions;
  protected componentOptions: ComponentOptions;

  constructor(
    paymentMethod: PaymentMethod,
    baseOptions: BaseOptions,
    componentOptions: ComponentOptions
  ) {
    this.paymentMethod = paymentMethod;
    this.baseOptions = baseOptions;
    this.componentOptions = componentOptions;
    this.componentOptions.showPayButton = true;
  }

  init() {
    this.component = this.buttons({});
  }

  /**
   * The SDK only exposes Buttons when that component was loaded, so resolve it
   * once here rather than asserting at each call site.
   */
  protected buttons(
    options: PayPalButtonsComponentOptions
  ): PayPalButtonsComponent {
    if (!this.baseOptions.sdk.Buttons) {
      throw new Error("PayPal SDK did not load the Buttons component");
    }
    return this.baseOptions.sdk.Buttons(options);
  }

  async submit(): Promise<void> {
    return;
  }

  async mount(selector: string): Promise<void> {
    this.component.render(selector);
  }

  isAvailable() {
    return Promise.resolve(true);
  }
}
