import { DashboardScrollView } from '@/components/dashboard/shared';
import { ProviderSettings } from '@/components/dashboard/provider-settings';

// Keep the existing page key so links from older chats continue to work.
export function CodexSettings() {
  return <DashboardScrollView><ProviderSettings /></DashboardScrollView>;
}
