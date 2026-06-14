import Modal from './Modal';
import Loading from './Loading';

const CONFIRM_VARIANT_CLASSES = {
  danger:
    'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
  warning:
    'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500',
  info:
    'bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-500',
};

export default function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'info',
  loading = false,
}) {
  const variantClass = CONFIRM_VARIANT_CLASSES[variant] || CONFIRM_VARIANT_CLASSES.info;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-surface-800 inline-flex items-center gap-2 ${variantClass} ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading && (
              <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-surface-600 dark:text-surface-400">{message}</p>
    </Modal>
  );
}
