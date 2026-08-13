import crypto from "crypto";
import prisma from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET || "sokrates-jwt-secret-key-2026-production-fallback";

export interface JwtPayload {
  userId: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, combinedHash: string): boolean {
  if (!combinedHash) return false;

  const parts = combinedHash.split(":");
  if (parts.length !== 2) {
    return false;
  }

  const [salt, originalHash] = parts;
  if (!salt || !originalHash) return false;

  const testHashBuf = Buffer.from(crypto.scryptSync(password, salt, 64).toString("hex"), "hex");
  const origHashBuf = Buffer.from(originalHash, "hex");

  if (testHashBuf.length !== origHashBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(testHashBuf, origHashBuf);
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

export function signJwt(payload: { userId: string; role?: string }, expiresInMs: number = 7 * 24 * 60 * 60 * 1000): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Date.now();
  const fullPayload: JwtPayload = {
    ...payload,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + expiresInMs) / 1000),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;

  const expectedSignature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const sigBuf = Buffer.from(signature);
  const expSigBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expSigBuf.length || !crypto.timingSafeEqual(sigBuf, expSigBuf)) {
    return null;
  }

  try {
    const payloadStr = base64UrlDecode(encodedPayload);
    const payload: JwtPayload = JSON.parse(payloadStr);

    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}

export async function getSessionUser(req: Request) {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  const decoded = verifyJwt(token);
  if (!decoded || !decoded.userId) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        interests: {
          include: {
            category: true,
          },
        },
      },
    });

    if (user?.suspended) return null;
    return user;
  } catch (err) {
    return null;
  }
}
