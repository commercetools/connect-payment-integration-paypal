export const paypalCreateOrderRequest = {
  intent: 'CAPTURE',
  purchase_units: [
    {
      reference_id: 'test',
      amount: {
        value: '50.00',
        currency_code: 'EUR',
      },
      items: [
        {
          name: 'Rasentraktorzündkabelverlängerung',
          sku: 'binfoord1000',
          unit_amount: {
            currency_code: 'EUR',
            value: '34.90',
          },
          tax: {
            currency_code: 'EUR',
            value: '0.00',
          },
          quantity: '1',
        },
      ],
      shipping: {
        type: 'SHIPPING',
        name: {
          full_name: 'Alois züm Hinterwald',
        },
        address: {
          address_line_1: 'Am Schragen 17',
          address_line_2: 'Hinterhöf',
          postal_code: '14476',
          admin_area_2: 'Potsdäm',
          country_code: 'DE',
          admin_area_1: 'Brandenbürg',
        },
      },
      invoice_id: 'invoiceid_1{{$timestamp}}',
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
