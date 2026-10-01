import { fleetflow } from '../generated/proto/messages.js';
import { createCrudApi } from './crud-api';

export interface UserDto {
  id: number;
  name: string;
  email: string;
  username?: string;
  role: string;
  roleId?: number;
  language: string;
  status: string;
  roleName?: string;
}

export const usersApi = createCrudApi<UserDto>('users', 'fleetflow.users.UsersService', fleetflow.users, 'User');
