import { Request, Response, NextFunction } from "express";
import { container } from "tsyringe";
import { ITokenService, TOKEN_SERVICE_TOKEN } from "@/services/ITokenService";
import {
  AuthenticationError,
  TokenExpiredError,
  InvalidTokenError,
} from "@/utils/errors/auth-errors";

/**
 * Authentication Middleware
 *
 * Extracts and verifies JWT token from Authorization header.
 * Attaches decoded user payload to request object.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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
