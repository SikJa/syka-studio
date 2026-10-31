import { splitProps, type JSX } from 'solid-js';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PreviewIcon } from './preview-icon';

type DockButtonProps = {
  label: string;
  icon: string;
  onClick: () => void;
  shortcut?: string;
  pressed?: boolean;
  disabled?: boolean;
  class?: string;
} & Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'class'> & { [data: `data-${string}`]: string | undefined };

/**
 * Every button on the preview dock: the same styled tooltip with its shortcut
 * set apart, and the same tinted outline and fill while its mode is on.
 */
export function DockButton(props: DockButtonProps) {
  const [own, rest] = splitProps(props, ['label', 'icon', 'onClick', 'shortcut', 'pressed', 'disabled', 'class']);
  return <Tooltip openDelay={80}>
    <TooltipTrigger as={Button} size="icon-square" variant="ghost" {...rest} disabled={own.disabled} aria-label={own.label}
      aria-pressed={own.pressed} onClick={() => own.onClick()} class={own.class}
      classList={{ 'syka-preview-active': !!own.pressed }}>
      <PreviewIcon name={own.icon} />
    </TooltipTrigger>
    <TooltipContent class="syka-transport-tooltip" shortcut={own.shortcut}>{own.label}</TooltipContent>
  </Tooltip>;
}
