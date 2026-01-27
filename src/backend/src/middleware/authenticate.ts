import { Request, Response, NextFunction } from "express";
import { container } from "tsyringe";
import { ITokenService, TOKEN_SERVICE_TOKEN } from "@/services/ITokenService";
import {
  AuthenticationError,
  TokenExpiredError,
  InvalidTokenError,
} from "@/utils/errors/auth-errors";
import { config } from "@/config/index";

/**
 * Authentication Middleware
 *
 * Extracts and verifies JWT token from Authorization header.
 * Attaches decoded user payload to request object.
 *
 * In development mode with SKIP_AUTH=true, authentication is bypassed.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Development bypass - skip auth when SKIP_AUTH env var is set
  if (config.nodeEnv === "development" && process.env.SKIP_AUTH === "true") {
    req.user = {
      userId: "dev-user",
      email: "dev@example.com",
      firstName: "Dev",
      lastName: "User",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      isFederated: false,
      federatedProvider: undefined,
      federatedProviderType: undefined,
      idpEmail: undefined,
      cognitoUsername: undefined,
    };
    next();
    return;
  }

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AuthenticationError("Authorization header is required");
    }

    // Extract Bearer token
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      throw new AuthenticationError(
        "Authorization header must be: Bearer <token>"
      );
    }

    const token = parts[1];
    if (!token) {
      throw new AuthenticationError("Token is required");
    }

    // Verify token
    const tokenService = container.resolve<ITokenService>(TOKEN_SERVICE_TOKEN);
    const payload = await tokenService.verifyToken(token);

    // Attach user to request
    req.user = payload;

    next();
  } catch (error) {
    if (
      error instanceof AuthenticationError ||
      error instanceof TokenExpiredError ||
      error instanceof InvalidTokenError
    ) {
      res.status(error.statusCode).json({
        error: error.name,
        message: error.message,
      });
      return;
    }

    // Unknown error
    res.status(500).json({
      error: "InternalError",
      message: "An error occurred during authentication",
    });
  }
}
