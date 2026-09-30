import { fleetflow } from '../generated/proto/messages.js';
import { createCrudClient } from './crud-client';

const { User, UserList, ListRequest, IdRequest, CreateUserRequest, UpdateUserRequest, DeleteResponse } = fleetflow.users;

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

export const usersClient = createCrudClient<UserDto>('fleetflow.users.UsersService', {
  ListRequest,
  ItemList: UserList,
  Item: User,
  IdRequest,
  CreateRequest: CreateUserRequest,
  UpdateRequest: UpdateUserRequest,
  DeleteResponse,
});
