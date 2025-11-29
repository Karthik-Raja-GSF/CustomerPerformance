import { TokenPayload } from '@/contracts/models/token-payload.model';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export {};
