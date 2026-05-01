import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

let ses: SESClient | undefined;

const getEnvValue = (name: string) => {
  const value = process.env[name]?.trim();
  return value || undefined;
};

const getSesCredentials = () => {
  const accessKeyId = getEnvValue('AWS_ACCESS_KEY_ID');
  const secretAccessKey = getEnvValue('AWS_SECRET_ACCESS_KEY');
  const sessionToken = getEnvValue('AWS_SESSION_TOKEN');

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'SES AWS credentials are not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.',
    );
  }

  if (accessKeyId.startsWith('ASIA') && !sessionToken) {
    throw new Error(
      'SES_AWS_SESSION_TOKEN is required when using temporary AWS credentials.',
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
    ...(sessionToken ? { sessionToken } : {}),
  };
};

const getSesClient = () => {
  ses ??= new SESClient({
    region: getEnvValue('SES_REGION') ?? 'us-east-1',
    credentials: getSesCredentials(),
  });

  return ses;
};

const getSourceEmail = () => {
  const sourceEmail = getEnvValue('SES_SOURCE_EMAIL');

  if (!sourceEmail) {
    throw new Error(
      'SES source email is not configured. Set SES_SOURCE_EMAIL.',
    );
  }

  return sourceEmail;
};

export const sendEmailNotification = async (
  userEmail: string,
  stock: string,
  price: number,
) => {
  await getSesClient().send(
    new SendEmailCommand({
      Source: getSourceEmail(),
      Destination: {
        ToAddresses: [userEmail],
      },
      Message: {
        Subject: {
          Data: 'Stock Purchase Confirmation',
        },
        Body: {
          Text: {
            Data: `
Stock purchased successfully.

Stock: ${stock}
Price: ${price}
          `,
          },
        },
      },
    }),
  );
};
