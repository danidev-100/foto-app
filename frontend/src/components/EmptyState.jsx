export default function EmptyState({
  icon: IconComponent,
  message,
  description,
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {IconComponent && (
        <div className="mb-4 text-surface-400 dark:text-surface-500">
          <IconComponent />
        </div>
      )}
      <p className="text-lg font-medium text-surface-700 dark:text-surface-300">
        {message}
      </p>
      {description && (
        <p className="mt-2 text-sm text-surface-500 dark:text-surface-400 max-w-md">
          {description}
        </p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-6 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
