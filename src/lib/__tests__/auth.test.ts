// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import { createSession, getSession, deleteSession, verifySession } from "../auth";

const JWT_SECRET = new TextEncoder().encode("development-secret-key");
const COOKIE_NAME = "auth-token";

async function signToken(payload: object, expiresIn = "7d") {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSession", () => {
  test("sets an httpOnly cookie", async () => {
    await createSession("user-1", "test@example.com");

    expect(mockCookieStore.set).toHaveBeenCalledOnce();
    const [name, _token, options] = mockCookieStore.set.mock.calls[0];
    expect(name).toBe(COOKIE_NAME);
    expect(options.httpOnly).toBe(true);
  });

  test("sets a lax sameSite cookie with path /", async () => {
    await createSession("user-1", "test@example.com");

    const [, , options] = mockCookieStore.set.mock.calls[0];
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("cookie token is a valid JWT containing userId and email", async () => {
    await createSession("user-42", "hello@example.com");

    const [, token] = mockCookieStore.set.mock.calls[0];
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);

    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(token, JWT_SECRET);
    expect(payload.userId).toBe("user-42");
    expect(payload.email).toBe("hello@example.com");
  });

  test("cookie expires approximately 7 days from now", async () => {
    const before = Date.now();
    await createSession("user-1", "test@example.com");
    const after = Date.now();

    const [, , options] = mockCookieStore.set.mock.calls[0];
    const expires: Date = options.expires;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });
});

describe("getSession", () => {
  test("returns null when no cookie is present", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns null when cookie value is an empty string", async () => {
    mockCookieStore.get.mockReturnValue({ value: "" });
    expect(await getSession()).toBeNull();
  });

  test("reads from the auth-token cookie", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    await getSession();
    expect(mockCookieStore.get).toHaveBeenCalledWith(COOKIE_NAME);
  });

  test("returns the session payload for a valid token", async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = await signToken({ userId: "user-1", email: "a@b.com", expiresAt });
    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session?.userId).toBe("user-1");
    expect(session?.email).toBe("a@b.com");
  });

  test("returns the full payload including expiresAt", async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = await signToken({ userId: "user-1", email: "a@b.com", expiresAt });
    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session?.expiresAt).toBeDefined();
  });

  test("returns null for a tampered token", async () => {
    mockCookieStore.get.mockReturnValue({ value: "not.a.valid.jwt" });
    expect(await getSession()).toBeNull();
  });

  test("returns null for a token signed with a different secret", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    const token = await new SignJWT({ userId: "user-1", email: "a@b.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .setIssuedAt()
      .sign(wrongSecret);
    mockCookieStore.get.mockReturnValue({ value: token });
    expect(await getSession()).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await signToken(
      { userId: "user-1", email: "a@b.com", expiresAt: new Date() },
      "-1s"
    );
    mockCookieStore.get.mockReturnValue({ value: token });
    expect(await getSession()).toBeNull();
  });
});

describe("deleteSession", () => {
  test("deletes the auth-token cookie", async () => {
    await deleteSession();
    expect(mockCookieStore.delete).toHaveBeenCalledWith(COOKIE_NAME);
  });
});

describe("verifySession", () => {
  function requestWithCookie(cookie: string) {
    return new NextRequest("http://localhost/", {
      headers: { cookie },
    });
  }

  test("returns null when no cookie is present", async () => {
    const request = new NextRequest("http://localhost/");
    expect(await verifySession(request)).toBeNull();
  });

  test("returns the session payload for a valid token", async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = await signToken({ userId: "user-2", email: "x@y.com", expiresAt });
    const request = requestWithCookie(`${COOKIE_NAME}=${token}`);

    const session = await verifySession(request);
    expect(session?.userId).toBe("user-2");
    expect(session?.email).toBe("x@y.com");
  });

  test("returns null for an invalid token", async () => {
    const request = requestWithCookie(`${COOKIE_NAME}=garbage`);
    expect(await verifySession(request)).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await signToken(
      { userId: "user-2", email: "x@y.com", expiresAt: new Date() },
      "-1s"
    );
    const request = requestWithCookie(`${COOKIE_NAME}=${token}`);
    expect(await verifySession(request)).toBeNull();
  });
});
