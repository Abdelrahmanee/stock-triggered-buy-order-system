import {
  PublishCommand,
  SetSubscriptionAttributesCommand,
  SNSClient,
  SubscribeCommand,
} from '@aws-sdk/client-sns';

type SnsOptions = {
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
};

type StockPriceDecreaseMessage = {
  stockId: string;
  symbol: string;
  oldPrice: number;
  newPrice: number;
  currency?: string;
};

const createSnsClient = (options: SnsOptions) => new SNSClient(options);

const createStockFilterPolicy = (stockIds: string[]) =>
  JSON.stringify({
    stockId: stockIds.length ? stockIds : ['__NO_SUBSCRIBED_STOCKS__'],
  });

export async function subscribeUser(
  userEmail: string,
  topicArn: string,
  stockIds: string[],
  options: SnsOptions,
) {
  const response = await createSnsClient(options).send(
    new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: 'email',
      Endpoint: userEmail,
      ReturnSubscriptionArn: true,
      Attributes: {
        FilterPolicy: createStockFilterPolicy(stockIds),
      },
    }),
  );

  return {
    subscriptionArn: response.SubscriptionArn,
    email: userEmail,
  };
}

export async function updateUserStockSubscriptionFilter(
  subscriptionArn: string,
  stockIds: string[],
  options: SnsOptions,
) {
  await createSnsClient(options).send(
    new SetSubscriptionAttributesCommand({
      SubscriptionArn: subscriptionArn,
      AttributeName: 'FilterPolicy',
      AttributeValue: createStockFilterPolicy(stockIds),
    }),
  );
}

export async function publishStockPriceDecrease(
  topicArn: string,
  input: StockPriceDecreaseMessage,
  options: SnsOptions,
) {
  const symbol = input.symbol.toUpperCase();
  const currency = input.currency ?? 'USD';

  const response = await createSnsClient(options).send(
    new PublishCommand({
      TopicArn: topicArn,
      Subject: `${symbol} price decreased`,
      Message: [
        `${symbol} stock price decreased.`,
        `Old price: ${input.oldPrice} ${currency}`,
        `New price: ${input.newPrice} ${currency}`,
      ].join('\n'),
      MessageAttributes: {
        stockId: {
          DataType: 'String',
          StringValue: input.stockId,
        },
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
