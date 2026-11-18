// Database error messages/details can echo submitted values. Keep operational
// logs useful with the stable SQLSTATE only; never serialize the provider/DB
// error object or row identifiers.
export function safeDatabaseErrorFields(error) {
  const code = typeof error?.code === "string" && /^[0-9A-Z]{5}$/.test(error.code)
    ? error.code
    : null;
  return code ? { databaseCode: code } : {};
}
