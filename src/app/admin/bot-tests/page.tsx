import BotTestsClient from '@/components/admin/BotTestsClient';
import { BotTestHistoryService } from '@/services/BotTestHistoryService';
import { BotTestScheduleService } from '@/services/BotTestScheduleService';
import { hasBotRedis } from '@/services/BotTestStorage';

export default async function BotTestsPage() {
  const [history, schedules] = await Promise.all([
    BotTestHistoryService.list(30),
    BotTestScheduleService.list(),
  ]);
  return <BotTestsClient initialHistory={history} initialSchedules={schedules} redisEnabled={hasBotRedis()} />;
}

