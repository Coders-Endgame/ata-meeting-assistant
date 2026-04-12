export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor(fn, options = {}) {
  const {
    timeout = 60_000,
    interval = 1_000,
    message = 'Condition was not met before timeout.',
  } = options;

  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeout) {
    try {
      const result = await fn();
      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }

    await sleep(interval);
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(message);
}
