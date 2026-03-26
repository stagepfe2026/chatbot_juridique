type SessionExpiredListener = (message?: string) => void;

const listeners = new Set<SessionExpiredListener>();

export function publishSessionExpired(message?: string): void {
  listeners.forEach((listener) => listener(message));
}

export function subscribeSessionExpired(listener: SessionExpiredListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
