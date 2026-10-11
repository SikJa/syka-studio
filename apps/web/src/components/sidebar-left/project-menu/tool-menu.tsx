/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { useWorld } from "@diffusionstudio/koota-solid";
import { Tool, ToolType } from "@diffusionstudio/runtime";

export function ToolMenu() {
  const world = useWorld();
  const setTool = (value: ToolType) => world.set(Tool, { value });

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuItem onSelect={() => setTool(ToolType.SCENE)}>
          Scene
          <DropdownMenuShortcut>F</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTool(ToolType.TEXT)}>
          Text
          <DropdownMenuShortcut>T</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTool(ToolType.RECT)}>
          Rectangle
          <DropdownMenuShortcut>R</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTool(ToolType.OBJECT_MASK)}>
          Object Mask
          <DropdownMenuShortcut>M</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>
  );
}
