import { Role } from './roles';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: Role;
        isActive: boolean;
      };
    }
  }
}

export {};
