/**
 * DropdownMenu constants and configurations
 */

export const DROPDOWN_VARIANTS = {
  DEFAULT: 'default',
  SUCCESS: 'success',
  DANGER: 'danger',
  WARNING: 'warning',
  INFO: 'info',
} as const;

export const DROPDOWN_SIZES = {
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
} as const;

export const DROPDOWN_POSITIONS = {
  LEFT: 'left',
  RIGHT: 'right',
  AUTO: 'auto',
} as const;

export const DROPDOWN_ALIGNMENTS = {
  START: 'start',
  CENTER: 'center',
  END: 'end',
} as const;

export const DEFAULT_CONFIG = {
  maxHeight: 384,
  hoverDelay: 200,
  closeDelay: 150,
  animationDuration: 200,
  focusDelay: 10,
} as const;

export const KEYBOARD_KEYS = {
  ESCAPE: 'Escape',
  ENTER: 'Enter',
  SPACE: ' ',
  ARROW_DOWN: 'ArrowDown',
  ARROW_UP: 'ArrowUp',
  TAB: 'Tab',
  HOME: 'Home',
  END: 'End',
} as const;