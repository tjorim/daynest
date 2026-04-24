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
    'medication' | 'medication_history' | 'routines' | 'overdue' | 'due_today' | 'upcoming' | 'planned'
  >
>;

const contractExample: TodayPayload = {
  medication: [
    {
      medication_dose_instance_id: 1,
      medication_plan_id: 5,
      name: 'Vitamin D',
      instructions: 'Take with breakfast and water.',
      scheduled_at: '2026-04-23T09:00:00Z',
      status: 'scheduled',
    },
  ],
  medication_history: [
    {
      medication_dose_instance_id: 2,
      medication_plan_id: 5,
      name: 'Vitamin D',
      instructions: 'Take with breakfast and water.',
      scheduled_at: '2026-04-22T09:00:00Z',
      status: 'taken',
    },
  ],
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
  overdue: [{ chore_instance_id: 7, chore_template_id: 3, title: 'Laundry', status: 'pending', overdue_since: '2026-04-20' }],
  due_today: [
    {
      chore_instance_id: 10,
      chore_template_id: 2,
      title: 'Morning stretch',
      status: 'pending',
      scheduled_date: '2026-04-23',
    },
  ],
  upcoming: [{ chore_instance_id: 12, chore_template_id: 4, title: 'Refill meds', scheduled_date: '2026-04-24' }],
  planned: [{ id: 13, title: 'Meal prep', planned_for: '2026-04-25' }],
};

void contractExample;
