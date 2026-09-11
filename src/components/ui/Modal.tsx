import type { HTMLAttributes, MouseEvent, ReactNode } from "react";

export type ModalSize = "sm" | "md" | "lg";

export interface ModalProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "children"> {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  size?: ModalSize;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  className = "",
  ...props
}: ModalProps) {
  if (!open) {
    return null;
  }

  const classes = [
    "ui-modal",
    `ui-modal--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const handleContentClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div className={classes} {...props}>
      <div
        className="ui-modal__overlay"
        role="presentation"
        onClick={onClose}
      >
        <div
          className="ui-modal__content"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ui-modal-title"
          onClick={handleContentClick}
        >
          <div className="ui-modal__header">
            <h2 id="ui-modal-title" className="ui-modal__title">
              {title}
            </h2>

            <button
              type="button"
              className="ui-modal__close"
              onClick={onClose}
              aria-label="Close modal"
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>

          <div className="ui-modal__body">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default Modal;
