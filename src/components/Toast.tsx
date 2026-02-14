import React from "react";

type ToastItem = {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function Toast({
  toasts,
  removeToast,
}: {
  toasts: ToastItem[];
  removeToast: (id: string) => void;
}) {
  return (
    <div className="toast-viewport">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <div className="toast-message">{t.message}</div>
          {t.actionLabel && (
            <button
              className="toast-action"
              onClick={() => {
                t.onAction?.();
                removeToast(t.id);
              }}
            >
              {t.actionLabel}
            </button>
          )}
          <button
            className="toast-close"
            onClick={() => removeToast(t.id)}
            aria-label="close"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
