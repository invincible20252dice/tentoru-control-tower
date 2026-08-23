import { describe, it, expect, beforeEach } from 'vitest';
import { db, Student, HomeworkResult } from '../lib/db';
import { generateAttendanceDates } from '../lib/scheduler';

describe('Auto Homework (2nd Drill) and Today Test Linkage Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('calculates the next attendance date based on student selected days', () => {
    const student: Student = {
      id: 'st-test-days',
      name: '通塾日テスト生徒',
      grade: '小5',
      selected_days: ['tuesday', 'friday'],
      slots_per_day: 2
    };

    const baseDate = '2026-08-25'; // 火曜日
    const futureDates = generateAttendanceDates(baseDate, student.selected_days || [], 5).filter(d => d > baseDate);

    expect(futureDates.length).toBeGreaterThan(0);
    // 8/25 (火) の次の通塾日は 8/28 (金)
    expect(futureDates[0]).toBe('2026-08-28');
  });

  it('correctly saves and fetches HomeworkResult with subject and homework_type', async () => {
    const hw: HomeworkResult = {
      id: 'hw-auto-1',
      student_id: 'st-hw-1',
      date: '2026-08-25',
      subject: '算数',
      homework_type: 'drill_2nd',
      homework_content: '算数: たしざん - かずをあらわす 〜 10までのたしざん(1)（2回目演習）',
      homework_deadline: '2026-08-28',
      status: 'incomplete',
      target_scope: 'individual',
      created_at: new Date().toISOString()
    };

    await db.saveHomeworkResult(hw);
    const fetched = db.getHomeworkResults().find(h => h.id === 'hw-auto-1');

    expect(fetched).toBeDefined();
    expect(fetched?.subject).toBe('算数');
    expect(fetched?.homework_type).toBe('drill_2nd');
    expect(fetched?.homework_content).toContain('（2回目演習）');
    expect(fetched?.homework_deadline).toBe('2026-08-28');
  });

  it('sanitizes HomeworkResult correctly with fallback deadline and default status', async () => {
    const rawHw: Partial<HomeworkResult> = {
      student_id: 'st-san-1',
      date: '2026-08-25',
      subject: '英語',
      homework_content: '英語: You are ~. あなたは〜です。 （2回目演習）'
    };

    const sanitized = await db.saveHomeworkResult(rawHw as HomeworkResult);
    expect(sanitized).toBeDefined();
    expect(sanitized.subject).toBe('英語');
    expect(sanitized.status).toBe('incomplete');
    expect(sanitized.homework_deadline).toBe('2026-08-25');
  });
});
