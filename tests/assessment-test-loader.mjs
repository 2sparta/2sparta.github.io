// Vite normally supplies import.meta.env. Give the DOM test the same public
// auth flag without changing production modules or connecting to an account.
export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (url.includes("/src/lib/auth/client.ts") && result.source) {
    return {
      ...result,
      source: String(result.source).replaceAll(
        "import.meta.env",
        '({ VITE_AUTH_ENABLED: "true" })',
      ),
    };
  }
  return result;
}
