import type { TodayPayload } from './today';

type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type TodayTopLevelKeys = keyof TodayPayload;
type _todayKeysAreStable = Expect<
  Equal<
    TodayTopLevelKeys,
    'medication' | 'routines' | 'overdue' | 'due_today' | 'upcoming' | 'planned'
  >
>;

const contractExample: TodayPayload = {
  medication: [{ id: 1, name: 'Vitamin D', due_at: '2026-04-23T09:00:00Z' }],
  routines: [
    {
      task_instance_id: 10,
      routine_template_id: 2,
      title: 'Morning stretch',
      status: 'pending',
      scheduled_date: '2026-04-23',
      due_at: null,
    },
  ],
  overdue: [{ id: 7, title: 'Laundry', overdue_since: '2026-04-20' }],
  due_today: [
    {
      task_instance_id: 10,
      title: 'Morning stretch',
      status: 'pending',
      scheduled_date: '2026-04-23',
      due_at: null,
    },
  ],
  upcoming: [{ id: 12, title: 'Refill meds', scheduled_date: '2026-04-24' }],
  planned: [{ id: 13, title: 'Meal prep', planned_for: '2026-04-25' }],
};

void contractExample;
