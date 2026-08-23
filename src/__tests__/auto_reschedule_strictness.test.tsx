import { describe, it, expect, beforeEach } from 'vitest';
import { db, Student, LearningTask } from '../lib/db';
import { generateSlotsForSelectedSubjects } from '../lib/scheduler';

describe('Auto Reschedule Strictness & Single Test Sync Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('locks To-target to the same unit test when From is a unit test', () => {
    const student: Student = {
      id: 'st-reschedule-1',
      name: '受講生A',
      grade: '小1',
      selected_subjects: ['算数', '英語', '国語'],
      period_count: 3
    };

    const masters = [
      {
        id: 'cm-add-test',
        subject: '算数',
        unit_name: 'たしざん',
        lesson_name: 'たしざん - 単元確認テスト',
        sort_order: 10,
        item_type: 'unit_test'
      }
    ];

    const slots = generateSlotsForSelectedSubjects({
      student,
      periodCount: 3,
      selectedSubjects: student.selected_subjects,
      tasks: [],
      curriculumMasters: masters as any
    });

    // 1コマ目(算数)が単元確認テストの場合、start_lesson と end_lesson が同一の単元確認テストであること
    const slot1 = slots[1];
    expect(slot1).toBeDefined();
    expect(slot1.subject).toBe('算数');
    if (slot1.startLessonName.includes('単元確認テスト')) {
      expect(slot1.endLessonName).toBe(slot1.startLessonName);
      expect(slot1.endLessonId).toBe(slot1.startLessonId);
    }
  });

  it('allocates all 3 selected subjects across 3 slots without leaving 3rd slot empty', () => {
    const student: Student = {
      id: 'st-reschedule-3slots',
      name: '3教科受講生',
      grade: '小2',
      selected_subjects: ['算数', '英語', '国語'],
      period_count: 3
    };

    const slots = generateSlotsForSelectedSubjects({
      student,
      periodCount: 3,
      selectedSubjects: student.selected_subjects,
      tasks: []
    });

    // 1〜3コマすべてに教科が割り当てられ空コマにならないこと
    expect(slots[1]).toBeDefined();
    expect(slots[1].subject).toBeTruthy();
    expect(slots[2]).toBeDefined();
    expect(slots[2].subject).toBeTruthy();
    expect(slots[3]).toBeDefined();
    expect(slots[3].subject).toBeTruthy();

    const subjectsInSlots = [slots[1].subject, slots[2].subject, slots[3].subject];
    expect(subjectsInSlots).toContain('算数');
    expect(subjectsInSlots).toContain('英語');
    expect(subjectsInSlots).toContain('国語');
  });
});
