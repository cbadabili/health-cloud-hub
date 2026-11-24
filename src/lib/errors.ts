/**
 * A user-facing message for anything thrown or returned as an error.
 * Supabase/PostgREST errors are plain objects with a `message`, not `Error`
 * instances, so check for both.
 */
export const errorMessage = (error: unknown, fallback = "Please try again."): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
};
