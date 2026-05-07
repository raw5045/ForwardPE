type InternalAuthOptions = {
  allowMissingToken?: boolean;
};

export function isAuthorizedRequest(
  request: Request,
  token = process.env.INTERNAL_ACCESS_TOKEN,
  options: InternalAuthOptions = {}
) {
  const normalizedToken = token?.trim();
  const allowMissingToken =
    options.allowMissingToken ?? process.env.NODE_ENV !== "production";

  if (!normalizedToken) {
    return allowMissingToken;
  }

  return request.headers.get("authorization") === `Bearer ${normalizedToken}`;
}
