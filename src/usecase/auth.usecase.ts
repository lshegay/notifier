import { sign, verify } from 'hono/jwt';
import type { UserRepository } from './user.repository';
import type { User, SafeUser, CreateUserDTO, JwtPayload } from '../domain/user';
import {
  ForbiddenError,
  UnauthorizedError,
  UserAlreadyExistsError,
  ValidationError,
} from '../domain/errors';
export type AuthUsecaseConfig = {
  jwtSecret: string;
  tokenExpiresInSeconds: number;
};

export class AuthUsecase {
  private readonly jwtSecret: string;
  private readonly tokenExpiresInSeconds: number;

  constructor(
    private readonly userRepo: UserRepository,
    config: AuthUsecaseConfig
  ) {
    this.jwtSecret = config.jwtSecret;
    this.tokenExpiresInSeconds = config.tokenExpiresInSeconds;
  }

  async login(
    email: string,
    password: string,
    onlyNotify: boolean = false
  ): Promise<{ token: string; user: SafeUser }> {
    if (!email || typeof email !== 'string' || !email.trim()) {
      throw new ValidationError('Email is required');
    }
    if (!password || typeof password !== 'string') {
      throw new ValidationError('Password is required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepo.findByEmail(normalizedEmail);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const passwordMatch = await Bun.password.verify(password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      template_ids: user.template_ids,
      onlyNotify,
      ...(onlyNotify ? {} : { exp: Math.floor(Date.now() / 1000) + this.tokenExpiresInSeconds }),
    };

    const token = await sign(payload, this.jwtSecret, 'HS256');

    return {
      token,
      user: this.toSafeUser(user),
    };
  }

  async register(dto: CreateUserDTO, currentUserRole?: string): Promise<SafeUser> {
    const userCount = await this.userRepo.count();

    // If users already exist in the database, registration requires admin role
    if (userCount > 0 && currentUserRole !== 'admin') {
      throw new ForbiddenError('Registration requires admin role');
    }

    if (!dto.name || typeof dto.name !== 'string' || !dto.name.trim()) {
      throw new ValidationError('Name is required and must not be empty');
    }
    if (!dto.email || typeof dto.email !== 'string' || !dto.email.trim()) {
      throw new ValidationError('Email is required and must not be empty');
    }
    if (!dto.password || typeof dto.password !== 'string' || dto.password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters long');
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.userRepo.findByEmail(normalizedEmail);
    if (existing) {
      throw new UserAlreadyExistsError(normalizedEmail);
    }

    // Hash password with Bun.password.hash
    const hashedPassword = await Bun.password.hash(dto.password);

    const created = await this.userRepo.create({
      name: dto.name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: dto.role ?? (userCount === 0 ? 'admin' : 'user'),
      template_ids: dto.template_ids ?? [],
    });

    return this.toSafeUser(created);
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      const decoded = (await verify(token, this.jwtSecret, 'HS256')) as unknown as JwtPayload;
      if (!decoded || !decoded.sub) {
        throw new UnauthorizedError('Invalid token payload');
      }
      return decoded;
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) {
        throw err;
      }
      throw new UnauthorizedError('Invalid or expired JWT token');
    }
  }

  toSafeUser(user: User): SafeUser {
    const { password: _, ...safe } = user;
    return safe;
  }
}
