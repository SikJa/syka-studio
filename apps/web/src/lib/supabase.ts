/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import type { SupabaseClient } from '@supabase/supabase-js';

// Syka has no Diffusion account. Never create its client, even if upstream
// environment variables are present: SDK initialization may refresh sessions.
export const supabase: SupabaseClient | null = null;
