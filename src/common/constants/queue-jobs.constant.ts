export const QUEUE_NAMES = {
  PRICE_UPDATES: 'price-updates',
  TRIGGER_EVALUATION: 'trigger-evaluation',
  ORDER_EXECUTION: 'order-execution',
  PRICE_SYNC: 'price-sync',
} as const;

export const JOB_NAMES = {
  PRICE_UPDATED: 'price-updated',
  EVALUATE_TRIGGER: 'evaluate-trigger',
  EXECUTE_ORDER: 'execute-order',
  SYNC_PRICES: 'sync-prices',
} as const;
