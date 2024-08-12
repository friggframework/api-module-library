export interface IStripeCharge {
  id: string;
  amount: number;
  amount_refunded: number;
  currency: string;
  created: number;
  payment_method_details: {
    type: string;
  };
  payment_method?: string;
  status: string;
  application: string;
}

type BalanceReportingCategory = 'charge';
type Currency = 'usd';
export type BalanceTransactionTypes =
  | 'adjustment'
  | 'advance'
  | 'advance_funding'
  | 'anticipation_repayment'
  | 'application_fee'
  | 'application_fee_refund'
  | 'charge'
  | 'connect_collection_transfer'
  | 'contribution'
  | 'issuing_authorization_hold'
  | 'issuing_authorization_release'
  | 'issuing_dispute'
  | 'issuing_transaction'
  | 'obligation_inbound'
  | 'obligation_outbound'
  | 'obligation_reversal_inbound'
  | 'obligation_reversal_outbound'
  | 'obligation_payout'
  | 'obligation_payout_failure'
  | 'payment, payment_failure_refund'
  | 'payment_refund'
  | 'payment_reversal'
  | 'payout'
  | 'payout_cancel'
  | 'payout_failure'
  | 'refund'
  | 'refund_failure'
  | 'reserve_transaction'
  | 'reserved_funds'
  | 'stripe_fee'
  | 'stripe_fx_fee'
  | 'tax_fee'
  | 'topup'
  | 'topup_reversal'
  | 'transfer'
  | 'transfer_cancel'
  | 'transfer_failure'
  | 'transfer_refund';

interface FeeDetail {
  amount: number;
  application: string | null;
  currency: Currency;
  description: string;
  type: 'application_fee' | 'stripe_fee' | 'tax';
}

export interface IBalanceTransaction {
  amount: number;
  available_on: number;
  created: number;
  currency: Currency;
  description: string;
  fee: number;
  fee_details?: FeeDetail[];
  id: string;
  net: number;
  object: 'balance_transaction';
  reporting_category: BalanceReportingCategory;
  source: string;
  status: string;
  type: BalanceTransactionTypes;
}

export interface IStripeResponse<T> {
  object: string;
  url: string;
  has_more: boolean;
  data: T;
}

export interface IStripeDateParameter {
  gt?: string;
  gte?: string;
  lt?: string;
  lte?: string;
}
