import React from 'react';
import { motion } from 'motion/react';
import { COMMAND_THEME_CLASS, commandCx } from '../uiTheme';

type CommandOverlayProps = {
  children: React.ReactNode;
  onBackdropClick?: () => void;
  className?: string;
};

export const CommandOverlay: React.FC<CommandOverlayProps> = ({
  children,
  onBackdropClick,
  className,
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className={commandCx(COMMAND_THEME_CLASS.overlay, 'p-3 md:p-6', className)}
    onMouseDown={onBackdropClick}
  >
    {children}
  </motion.div>
);

