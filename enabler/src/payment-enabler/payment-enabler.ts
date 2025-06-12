export interface PaymentComponent {
  mount(selector: string): Promise<void> | void;
  submit(): Promise<void> | void;
  showValidation?(): Promise<void> | void;
  isValid?(): boolean;
  getState?(): {
    card?: {
      endDigits?: string;
      brand?: string;
      expiryDate?: string;
    }
  };
  isAvailable?(): Promise<boolean>;
}

export interface PaymentComponentBuilder {
  componentHasSubmit: boolean;
  build(config: ComponentOptions): PaymentComponent;
}

export type EnablerOptions = {
  processorUrl: string;
  sessionId: string;
  locale?: string; // TODO check if this needs implementation
  onActionRequired?: () => Promise<void>; // TODO check if this needs implementation
  onComplete?: (result: PaymentResult) => void;
  onError?: (error: any) => void;
};

export enum PaymentMethod {
  paypal = 'paypal'
};

export type PaymentResult = {
  isSuccess: true;
  paymentReference: string;
} | { isSuccess: false };

export type ComponentOptions = {
  showPayButton?: boolean;
  onPayButtonClick?: () => Promise<void>;
};

export interface PaymentEnabler {
  /** 
   * @throws {Error}
   */
  createComponentBuilder: (type: string) => Promise<PaymentComponent | never>
}
