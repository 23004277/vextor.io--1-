import React from 'react';
import { COMMAND_THEME_CLASS, commandCx } from '../uiTheme';

type CommandHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  status?: React.ReactNode;
  closeLabel?: string;
  onClose?: () => void;
  icon?: React.ReactNode;
  className?: string;
};

export const CommandHeader: React.FC<CommandHeaderProps> = ({
  eyebrow,
  title,
  description,
  status,
  closeLabel = 'Close dialog',
  onClose,
  icon,
  className,
}) => (
  <header className={commandCx(COMMAND_THEME_CLASS.header, 'px-6 py-5 md:px-8', className)}>
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-4">
        {icon && (
          <div className={commandCx(COMMAND_THEME_CLASS.shellInset, 'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl')}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && <div className={COMMAND_THEME_CLASS.eyebrow}>{eyebrow}</div>}
          <h2 className={commandCx(COMMAND_THEME_CLASS.title, eyebrow ? 'mt-1' : '')}>{title}</h2>
          {description && <p className={commandCx(COMMAND_THEME_CLASS.body, 'mt-2 max-w-3xl')}>{description}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-start gap-3">
        {status}
        {onClose && (
          <button
            type="button"
            data-autofocus="true"
            aria-label={closeLabel}
            onClick={onClose}
            className={commandCx(COMMAND_THEME_CLASS.buttonGhost, 'flex h-11 w-11 items-center justify-center rounded-2xl')}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  </header>
);

