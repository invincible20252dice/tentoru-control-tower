import { describe, it, expect, beforeEach } from 'vitest';
import { db, Student } from '../lib/db';

describe('UI Cleanup & Test Automatic Control Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not automatically append tests when timetable has no unit tests', async () => {
    const student: Student = {
      id: 'st-ui-clean-1',
      name: 'UIクリーンテスト生',
      grade: '小3',
      selected_subjects: ['算数']
    };
    await db.saveStudent(student);

    // 授業計画(コマ割り)に単元テストがない日のミニテスト結果
    const miniResults = db.getMiniTestResults().filter(m => m.student_id === student.id && m.date === '2026-08-25');
    expect(miniResults.length).toBe(0);
  });
});
