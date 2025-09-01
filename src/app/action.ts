"use server";

import { cookies } from "next/headers";

export async function setMyCookie(key: string, value: string) {
  (await cookies()).set(key, value, {
    httpOnly: true,
    secure: true,
    maxAge: 60 * 60 * 24 * 365 * 100,
  });
}

export async function getMyCookie(key: string) {
  return (await cookies()).get(key)?.value;
}

export async function clearMyCookie(key: string) {
  (await cookies()).set(key, "", {
    expires: new Date(0),
  });
}
