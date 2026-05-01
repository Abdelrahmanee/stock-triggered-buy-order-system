import { PublishCommand, SNSClient, SubscribeCommand } from '@aws-sdk/client-sns';

let sns: SNSClient | undefined;

const getEnvValue = (name: string) => {
  const value = process.env[name]?.trim();
  return value || undefined;
};

const getSnsCredentials = () => {
  const accessKeyId = getEnvValue('AWS_ACCESS_KEY_ID');
  const secretAccessKey = getEnvValue('AWS_SECRET_ACCESS_KEY');
  const sessionToken = getEnvValue('AWS_SESSION_TOKEN');

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'SNS AWS credentials are not configured. Set SNS_AWS_ACCESS_KEY_ID and SNS_AWS_SECRET_ACCESS_KEY.',
    );
  }

  if (accessKeyId.startsWith('ASIA') && !sessionToken) {
    throw new Error(
      'SNS_AWS_SESSION_TOKEN is required when using temporary AWS credentials.',
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
    ...(sessionToken ? { sessionToken } : {}),
  };
};

const getSnsClient = () => {
  sns ??= new SNSClient({
    region: getEnvValue('SNS_REGION') ?? 'us-east-1',
    credentials: getSnsCredentials(),
  });

  return sns;
};

export async function subscribeUser(userEmail: string, topicArn: string) {
  const response = await getSnsClient().send(
    new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: 'email',
      Endpoint: userEmail,
      ReturnSubscriptionArn: true,
    }),
  );

  return {
    subscriptionArn: response.SubscriptionArn,
    email: userEmail,
  };
}

type StockPriceDecreaseMessage = {
  symbol: string;
  oldPrice: number;
  newPrice: number;
  currency?: string;
};

export async function publishStockPriceDecrease(
  topicArn: string,
  input: StockPriceDecreaseMessage,
) {
  const symbol = input.symbol.toUpperCase();
  const currency = input.currency ?? 'USD';

  const response = await getSnsClient().send(
    new PublishCommand({
      TopicArn: topicArn,
      Subject: `${symbol} price decreased`,
      Message: [
        `${symbol} stock price decreased.`,
        `Old price: ${input.oldPrice} ${currency}`,
        `New price: ${input.newPrice} ${currency}`,
      ].join('\n'),
      MessageAttributes: {
        symbol: {
          DataType: 'String',
          StringValue: symbol,
        },
      },
    }),
  );

  return {
    messageId: response.MessageId,
    stockSymbol: symbol,
  };
}
