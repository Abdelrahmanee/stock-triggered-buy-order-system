import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findAll() {
  }
  async create(input: {
    name: string;
    email: string;
    password: string;
    walletBalance?: number;
  }) {
    return this.userModel.create(input);
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() }).lean();
  }

  async findById(userId: string | Types.ObjectId) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async incrementWallet(userId: string, amount: number) {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $inc: { walletBalance: amount } },
        { returnDocument: 'after', lean: true },
      )
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async reserveFunds(userId: string, amount: number) {
    return this.userModel
      .findOneAndUpdate(
        {
          _id: userId,
          walletBalance: { $gte: amount },
          status: 'active',
        },
        { $inc: { walletBalance: -amount } },
        { returnDocument: 'after', lean: true },
      )
      .exec();
  }
}
