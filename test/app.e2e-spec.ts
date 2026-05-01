import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as request from 'supertest';
import { BuyOrder } from '../src/modules/orders/schemas/buy-order.schema';
import { TradeExecution } from '../src/modules/orders/schemas/trade-execution.schema';
import { User } from '../src/modules/users/schemas/user.schema';
import { AppModule } from './../src/app.module';

describe('Stock Triggered Buy Order System (e2e)', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;
  let buyOrderModel: Model<BuyOrder>;
  let tradeExecutionModel: Model<TradeExecution>;
  let userModel: Model<User>;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.JWT_SECRET = 'test-secret';
    process.env.QUEUE_DRIVER = 'inline';
    process.env.STOCK_PROVIDER_MODE = 'mock';
    process.env.JWT_EXPIRES_IN = '1d';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    buyOrderModel = moduleFixture.get<Model<BuyOrder>>(getModelToken(BuyOrder.name));
    tradeExecutionModel = moduleFixture.get<Model<TradeExecution>>(
      getModelToken(TradeExecution.name),
    );
    userModel = moduleFixture.get<Model<User>>(getModelToken(User.name));
  });

  afterEach(async () => {
    await Promise.all([
      buyOrderModel.deleteMany({}),
      tradeExecutionModel.deleteMany({}),
      userModel.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await app.close();
    await mongoServer.stop();
  });

  it('registers, logs in, and hides the password field', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'secret123',
        walletBalance: 1000,
      })
      .expect(201);

    expect(registerResponse.body.accessToken).toBeDefined();
    expect(registerResponse.body.user.password).toBeUndefined();
    expect(registerResponse.body.user.walletBalance).toBe(1000);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'alice@example.com',
        password: 'secret123',
      })
      .expect(201);

    expect(loginResponse.body.accessToken).toBeDefined();
    expect(loginResponse.body.user.password).toBeUndefined();
  });

  it('executes a pending order when price reaches the target and updates wallet state', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'Trader',
        email: 'trader@example.com',
        password: 'secret123',
        walletBalance: 1000,
      })
      .expect(201);

    const token = registerResponse.body.accessToken;

    const orderResponse = await request(app.getHttpServer())
      .post('/api/orders/buy-trigger')
      .set('Authorization', `Bearer ${token}`)
      .send({
        symbol: 'AAPL',
        targetPrice: 170,
        quantity: 2,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/stock-events/price-update')
      .send({
        symbol: 'AAPL',
        price: 169,
      })
      .expect(201);

    const order = await buyOrderModel.findById(orderResponse.body._id).lean();
    expect(order?.status).toBe('completed');
    expect(order?.executedPrice).toBe(169);

    const execution = await tradeExecutionModel
      .findOne({ symbol: 'AAPL' })
      .lean();
    expect(execution?.totalCost).toBe(338);

    const profileResponse = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profileResponse.body.walletBalance).toBe(662);
  });

  it('avoids duplicate execution and fails extra triggered orders when funds run out', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'Budget Trader',
        email: 'budget@example.com',
        password: 'secret123',
        walletBalance: 200,
      })
      .expect(201);

    const token = registerResponse.body.accessToken;

    const firstOrder = await request(app.getHttpServer())
      .post('/api/orders/buy-trigger')
      .set('Authorization', `Bearer ${token}`)
      .send({
        symbol: 'TSLA',
        targetPrice: 100,
        quantity: 1,
      })
      .expect(201);

    const secondOrder = await request(app.getHttpServer())
      .post('/api/orders/buy-trigger')
      .set('Authorization', `Bearer ${token}`)
      .send({
        symbol: 'TSLA',
        targetPrice: 100,
        quantity: 2,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/stock-events/price-update')
      .send({
        symbol: 'TSLA',
        price: 100,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/stock-events/price-update')
      .send({
        symbol: 'TSLA',
        price: 100,
      })
      .expect(201);

    const refreshedFirstOrder = await buyOrderModel
      .findById(firstOrder.body._id)
      .lean();
    const refreshedSecondOrder = await buyOrderModel
      .findById(secondOrder.body._id)
      .lean();

    const executionCount = await tradeExecutionModel.countDocuments({
      symbol: 'TSLA',
    });

    expect(executionCount).toBe(1);
    expect(
      [refreshedFirstOrder?.status, refreshedSecondOrder?.status].sort(),
    ).toEqual(['completed', 'failed']);
    expect(
      [refreshedFirstOrder?.statusReason, refreshedSecondOrder?.statusReason],
    ).toContain('rejected_insufficient_funds');
  });
});
