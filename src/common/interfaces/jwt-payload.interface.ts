import { UserRole } from '../constants/user-role.constant';

export interface JwtPayload {
  sub: string;
  email: string;
  status: string;
  role?: UserRole;
}
