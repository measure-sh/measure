import { NextResponse } from "next/server";

export function setCookiesFromJWT(
  accessToken: string,
  refreshToken: string,
  response: NextResponse<any>,
): NextResponse<any> {
  // Decode the access token to extract the expiry
  const accessTokenPayload = JSON.parse(
    Buffer.from(accessToken.split(".")[1], "base64").toString(),
  );
  const accessExp = new Date(accessTokenPayload.exp * 1000);

  // Decode the refresh token to extract the expiry
  const refreshTokenPayload = JSON.parse(
    Buffer.from(refreshToken.split(".")[1], "base64").toString(),
  );
  const refreshExp = new Date(refreshTokenPayload.exp * 1000);
  const isDev = process.env.NODE_ENV !== "production";

  response.cookies.set("access_token", accessToken, {
    path: "/",
    maxAge: Math.floor((accessExp.getTime() - Date.now()) / 1000),
    httpOnly: true,
    secure: !isDev,
    sameSite: isDev ? "lax" : "strict",
  });

  response.cookies.set("refresh_token", refreshToken, {
    path: "/",
    maxAge: Math.floor((refreshExp.getTime() - Date.now()) / 1000),
    httpOnly: true,
    secure: !isDev,
    sameSite: isDev ? "lax" : "strict",
  });

  return response;
}
