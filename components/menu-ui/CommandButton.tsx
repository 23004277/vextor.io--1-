import React from 'react';
import { COMMAND_THEME_CLASS, commandCx } from '../uiTheme';

type CommandButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type CommandButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: CommandButtonVariant;
};

const variantClass: Record<CommandButtonVariant, string> = {
  primary: COMMAND_THEME_CLASS.buttonPrimary,
  secondary: COMMAND_THEME_CLASS.button,
  ghost: COMMAND_THEME_CLASS.buttonGhost,
  danger: COMMAND_THEME_CLASS.buttonDanger,
};

export const CommandButton: React.FC<CommandButtonProps> = ({
  variant = 'secondary',
  className,
  children,
  ...props
}) => (
  <button
    {...props}
    className={commandCx(
      'rounded-xl px-5 py-3 text-[11px] font-black uppercase tracking-[0.22em] transition disabled:cursor-not-allowed disabled:opacity-50',
      variantClass[variant],
      className,
    )}
  >
    {children}
  </button>
);

