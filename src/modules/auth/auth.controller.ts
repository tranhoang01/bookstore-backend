// src/modules/auth/auth.controller.ts
import { Request, Response, NextFunction } from "express";
import {
  loginService,
  logoutService,
  refreshTokenService,
  signupService,
} from "./auth.service";

/**
 * 회원가입 컨트롤러
 */
export async function signupController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email, password, name, phone } = req.body;

    const user = await signupService({ email, password, name, phone });

    return res.status(201).json({
      isSuccess: true,
      message: "회원가입 완료",
      payload: {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 로그인 컨트롤러
 */
export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email, password } = req.body;

    const userAgentHeader = req.headers["user-agent"] as string | undefined;
    const ipHeader =
      (req.headers["x-forwarded-for"] as string | undefined) ||
      req.socket.remoteAddress ||
      undefined;

    // 👇 여기가 핵심: undefined 인 경우에는 아예 속성을 넣지 않도록 처리
    const loginParams: {
      email: string;
      password: string;
      userAgent?: string;
      ipAddress?: string;
    } = { email, password };

    if (userAgentHeader) {
      loginParams.userAgent = userAgentHeader;
    }
    if (ipHeader) {
      loginParams.ipAddress = ipHeader;
    }

    const result = await loginService(loginParams);

    return res.status(200).json({
      isSuccess: true,
      message: "로그인 성공",
      payload: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 토큰 갱신 컨트롤러
 */
export async function refreshTokenController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { refreshToken } = req.body;

    const userAgentHeader = req.headers["user-agent"] as string | undefined;
    const ipHeader =
      (req.headers["x-forwarded-for"] as string | undefined) ||
      req.socket.remoteAddress ||
      undefined;

    const refreshParams: {
      refreshToken: string;
      userAgent?: string;
      ipAddress?: string;
    } = { refreshToken };

    if (userAgentHeader) {
      refreshParams.userAgent = userAgentHeader;
    }
    if (ipHeader) {
      refreshParams.ipAddress = ipHeader;
    }

    const result = await refreshTokenService(refreshParams);

    return res.status(200).json({
      isSuccess: true,
      message: "토큰 갱신 성공",
      payload: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
}


/**
 * 로그아웃 컨트롤러
 * Logout controller
 */
export async function logoutController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { refreshToken } = req.body;

    await logoutService({ refreshToken });

    return res.status(200).json({
      isSuccess: true,
      message: "로그아웃 완료",
      payload: null,
    });
  } catch (err) {
    next(err);
  }
}
