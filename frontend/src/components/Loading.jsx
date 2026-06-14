export default function Loading({ variant = 'spinner', count = 3, className = '' }) {
  if (variant === 'skeleton') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            data-testid="skeleton-line"
            className="h-4 bg-surface-200 dark:bg-surface-700 rounded animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`grid gap-4 ${className}`}>
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            data-testid="skeleton-card"
            className="border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden"
          >
            <div
              data-testid="skeleton-card-image"
              className="h-40 bg-surface-200 dark:bg-surface-700 animate-pulse"
            />
            <div className="p-4 space-y-3">
              <div
                data-testid="skeleton-line"
                className="h-4 bg-surface-200 dark:bg-surface-700 rounded animate-pulse w-3/4"
              />
              <div
                data-testid="skeleton-line"
                className="h-4 bg-surface-200 dark:bg-surface-700 rounded animate-pulse w-1/2"
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // spinner variant (default)
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        data-testid="loading-spinner"
        className="h-8 w-8 border-4 border-surface-200 dark:border-surface-700 border-t-primary-600 rounded-full animate-spin"
      />
    </div>
  );
}
