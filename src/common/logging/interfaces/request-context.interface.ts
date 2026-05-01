export interface RequestContextStore {
  traceId: string;
  source: 'http' | 'queue' | 'system';
  method?: string;
  path?: string;
  userId?: string;
  queueName?: string;
  jobName?: string;
}
