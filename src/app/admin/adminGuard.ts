export function assertDev(message = 'Admin actions are only available in development mode.'): void {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error(message);
  }
}

export function withDevGuard<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  message?: string,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    assertDev(message);
    return action(...args);
  };
}
