// Loads .env (Node >=20.6 has a built-in loader) if present. All values are
// optional — credentials can also be supplied at runtime via the login endpoint.
try {
  process.loadEnvFile();
} catch {
  // No .env file — rely on the ambient environment / runtime login instead.
}

export const env = {
  dapUri: process.env.dap_uri,
  dapClientId: process.env.dap_client_id,
  dapClientSecret: process.env.dap_client_secret,
};
