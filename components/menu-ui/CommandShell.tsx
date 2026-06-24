import React from 'react';
import { motion } from 'motion/react';
import { COMMAND_THEME_CLASS, commandCx } from '../uiTheme';

type CommandShellProps = React.ComponentPropsWithoutRef<'div'> & {
  children: React.ReactNode;
};

export const CommandShell = React.forwardRef<HTMLDivElement, CommandShellProps>(
  ({ children, className, ...rest }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.97 }}
      transition={{ type: 'spring', damping: 24, stiffness: 220 }}
      className={commandCx(COMMAND_THEME_CLASS.shell, 'overflow-hidden rounded-[2rem]', className)}
      {...rest}
    >
      {children}
    </motion.div>
  ),
);

CommandShell.displayName = 'CommandShell';
