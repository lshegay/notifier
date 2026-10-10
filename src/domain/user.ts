export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole | string;
  template_ids: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type SafeUser = Omit<User, 'password'>;

export type CreateUserDTO = {
  name: string;
  email: string;
  password: string;
  role?: UserRole | string;
  template_ids?: string[];
};

export type UpdateUserDTO = {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole | string;
  template_ids?: string[];
};

export type LoginDTO = {
  email: string;
  password: string;
  onlyNotify?: boolean;
};

export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  template_ids: string[];
  onlyNotify?: boolean;
  exp?: number;
};
