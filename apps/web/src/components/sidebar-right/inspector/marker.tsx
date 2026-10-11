/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { createSignal } from 'solid-js';
import { ControlRow } from '@/components/ui/control-group';
import { Icon } from '@/components/ui/icon';
import { PanelSection } from '@/components/ui/panel-section';
import { ControlledTextField } from '@/components/ui/text-field';
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectPortal,
} from '@/components/ui/select';

const MARKER_COLORS = [
  { value: 'yellow', label: 'Yellow', hex: '#F59E0B' },
  { value: 'blue', label: 'Blue', hex: '#3B82F6' },
  { value: 'green', label: 'Green', hex: '#10B981' },
  { value: 'pink', label: 'Pink', hex: '#EC4899' },
  { value: 'purple', label: 'Purple', hex: '#A855F7' },
  { value: 'orange', label: 'Orange', hex: '#F97316' },
  { value: 'cyan', label: 'Cyan', hex: '#06B6D4' },
  { value: 'red', label: 'Red', hex: '#EF4444' },
] as const;

export function MarkerPanel() {
  const [timecode, setTimecode] = createSignal('00:00:07');
  const [color, setColor] = createSignal<string>('pink');

  const selectedColor = () => MARKER_COLORS.find((c) => c.value === color());

  return (
    <PanelSection
      title="Marker"
      actions={
        <Tooltip>
          <TooltipTrigger
            as={Button}
            size="icon"
            variant="ghost"
            class="text-muted-foreground"
          >
            <Icon name="plus-add" />
          </TooltipTrigger>
          <TooltipContent>Add marker</TooltipContent>
        </Tooltip>
      }
    >
      <ControlRow label="Marker" contentClass="grid grid-cols-2 gap-2">
        <ControlledTextField
          value={timecode()}
          onChange={(e) => setTimecode(e.currentTarget.value)}
        />
        <Select
          value={color()}
          onChange={(v) => setColor(v ?? 'pink')}
          options={MARKER_COLORS.map((c) => c.value)}
          itemComponent={(itemProps) => {
            const itemColor = () =>
              MARKER_COLORS.find((c) => c.value === itemProps.item.rawValue);
            return (
              <SelectItem item={itemProps.item}>
                <div class="flex items-center gap-2">
                  <div
                    class="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ "background-color": itemColor()?.hex }}
                  />
                  <span>{itemColor()?.label}</span>
                </div>
              </SelectItem>
            );
          }}
        >
          <SelectTrigger>
            <SelectValue class="text-xxs">
              {() => (
                <div class="flex items-center gap-2">
                  <div
                    class="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ "background-color": selectedColor()?.hex }}
                  />
                  <span>{selectedColor()?.label}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectPortal>
            <SelectContent />
          </SelectPortal>
        </Select>
      </ControlRow>
    </PanelSection>
  );
}
