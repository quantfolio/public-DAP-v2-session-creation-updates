// Loads .env (Node >=20.6 has a built-in loader) and validates required vars.
try {
  process.loadEnvFile();
} catch {
  // No .env file present — rely on the ambient environment instead.
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  dapUri: required("dap_uri"),
  dapClientId: required("dap_client_id"),
  dapClientSecret: required("dap_client_secret"),
};
