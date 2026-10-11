/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { DropdownMenuItem, DropdownMenuGroup } from '@/components/ui/dropdown-menu';
import { openSettings } from '@/components/settings/state';
import { requestEditorTour } from '@/components/onboarding/editor-tour-model';

export function HelpMenu() {
  return (
    <DropdownMenuGroup>
      <DropdownMenuItem onSelect={() => setTimeout(requestEditorTour, 120)}>Recorrer el editor</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => openSettings('help')}>Acerca de Syka Studio</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => openSettings('plugins')}>Conexiones y herramientas MCP</DropdownMenuItem>
    </DropdownMenuGroup>
  );
}
