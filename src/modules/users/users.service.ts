import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '../../common/constants/user-role.constant';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findAll() {}
  async create(input: {
    name: string;
    email: string;
    password: string;
    walletBalance?: number;
    role?: UserRole;
  }) {
    return this.userModel.create(input);
  }

  async findByEmail(email: string) {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('-password')
      .lean();
  }

  async findById(userId: string | Types.ObjectId) {
    const user = await this.userModel
      .findById(userId)
      .select('-password')
      .lean();
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
      .select('-password')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateRole(userId: string, role: UserRole) {
    return this.userModel
      .findByIdAndUpdate(userId, { role }, { returnDocument: 'after', lean: true })
      .select('-password')
      .exec();
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { avatarUrl },
        { returnDocument: 'after', lean: true },
      )
      .select('-password')
      .exec();
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
      .select('-password')
      .exec();
  }
}
