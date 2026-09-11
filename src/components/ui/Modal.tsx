import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({
  children,
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="ui-modal-backdrop"
      onMouseDown={onClose}
      role="dialog"
    >
      <section
        aria-labelledby="modal-title"
        className={`ui-modal ui-modal--${size}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="ui-modal__header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>

          <button
            aria-label="Hikatona"
            className="ui-modal__close"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </header>

        <div className="ui-modal__content">{children}</div>
      </section>
    </div>
  );
        }
