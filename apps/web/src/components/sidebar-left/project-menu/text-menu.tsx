/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";

export function TextMenu() {
  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuItem>
          Bold
          <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          Italic
          <DropdownMenuShortcut>⌘I</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          Underline
          <DropdownMenuShortcut>⌘U</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          Strikethrough
          <DropdownMenuShortcut>⇧⌘X</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />

      <DropdownMenuGroup>
        <DropdownMenuItem>
          Text align left
          <DropdownMenuShortcut>⌥⌘L</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          Text align center
          <DropdownMenuShortcut>⌥⌘T</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          Text align right
          <DropdownMenuShortcut>⌥⌘R</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          Text align justified
          <DropdownMenuShortcut>⌥⌘J</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />

      <DropdownMenuGroup>
        <DropdownMenuItem>
          Wrap in caption group
          <DropdownMenuShortcut>⇧⌥C</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          Detach caption group
          <DropdownMenuShortcut>⌥⌘B</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>
  );
}
