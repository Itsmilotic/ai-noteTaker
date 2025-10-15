import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  // Next.js 15 temporarily requires coercing cookies() to gain mutable access for Supabase session syncing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cookieStore = (await cookies()) as any;

  const client = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {}
        },
      },
    },
  );

  return client;
}

const isAuthSessionMissing = (error: unknown) => {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: number }).status === 400
  );
};

export async function getUser() {
  const { auth } = await createClient();

  try {
    const { data, error } = await auth.getUser();

    if (error) {
      if (isAuthSessionMissing(error)) {
        return null;
      }
      console.error(error);
      return null;
    }

    return data.user;
  } catch (error) {
    if (isAuthSessionMissing(error)) {
      return null;
    }
    console.error(error);
    return null;
  }
}
