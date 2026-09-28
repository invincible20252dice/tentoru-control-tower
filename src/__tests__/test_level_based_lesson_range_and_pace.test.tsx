import React, { act } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';
import { 
  inferStudentSubjectPace, 
  calculateLessonRangeForSlot, 
  generateSlotsForSelectedSubjects, 
  LEVEL_PACE_CONFIG 
} from '../lib/scheduler';
import { Student, CurriculumMaster } from '../types';

describe('Level-Based Lesson Range (From-To) & Estimated Pace Suite', () => {
  const studentLevelA: Student = {
    id: 'std-lvl-a',
    student_id: 'S_LVL_A',
    name: 'レベルA 生徒',
    grade: '小5',
    level: 'A',
    branch_id: 'branch-1',
    classroom: '恵比寿教室',
    status: 'normal',
    period_count: 2,
    selected_days: ['monday', 'thursday'],
    selected_subjects: ['算数', '英語'],
    created_at: '2026-04-01T00:00:00Z'
  };

  const studentLevelB: Student = {
    id: 'std-lvl-b',
    student_id: 'S_LVL_B',
    name: 'レベルB 生徒',
    grade: '小5',
    level: 'B',
    branch_id: 'branch-1',
    classroom: '恵比寿教室',
    status: 'normal',
    period_count: 2,
    selected_days: ['monday', 'thursday'],
    selected_subjects: ['算数', '英語'],
    created_at: '2026-04-01T00:00:00Z'
  };

  const studentLevelC: Student = {
    id: 'std-lvl-c',
    student_id: 'S_LVL_C',
    name: 'レベルC 生徒',
    grade: '小5',
    level: 'C',
    branch_id: 'branch-1',
    classroom: '恵比寿教室',
    status: 'normal',
    period_count: 2,
    selected_days: ['monday', 'thursday'],
    selected_subjects: ['算数', '英語'],
    created_at: '2026-04-01T00:00:00Z'
  };

  const sampleMasters: CurriculumMaster[] = [
    { id: 'cm-step1', subject: '算数', grade: '小5', unit_name: '小数のかけ算', lesson_name: 'STEP 1', sort_order: 1 },
    { id: 'cm-step2', subject: '算数', grade: '小5', unit_name: '小数のかけ算', lesson_name: 'STEP 2', sort_order: 2 },
    { id: 'cm-step3', subject: '算数', grade: '小5', unit_name: '小数のかけ算', lesson_name: 'STEP 3', sort_order: 3 },
    { id: 'cm-step4', subject: '算数', grade: '小5', unit_name: '小数のかけ算', lesson_name: 'STEP 4', sort_order: 4 },
    { id: 'cm-step5', subject: '算数', grade: '小5', unit_name: '小数のかけ算', lesson_name: 'STEP 5', sort_order: 5 },
    { id: 'cm-test1', subject: '算数', grade: '小5', unit_name: '小数のかけ算', lesson_name: '小数のかけ算 単元確認テスト', sort_order: 6 },
    { id: 'cm-next1', subject: '算数', grade: '小5', unit_name: '小数のわり算', lesson_name: 'STEP 1', sort_order: 7 },
  ];

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    db.saveStudent(studentLevelA);
    db.saveStudent(studentLevelB);
    db.saveStudent(studentLevelC);
    await db.saveCurriculumMasters(sampleMasters);
  });

  it('verifies LEVEL_PACE_CONFIG default paces and multiplier values', () => {
    expect(LEVEL_PACE_CONFIG.A.defaultPace).toBe(4);
    expect(LEVEL_PACE_CONFIG.A.multiplier).toBe(4.0);
    expect(LEVEL_PACE_CONFIG.B.defaultPace).toBe(2);
    expect(LEVEL_PACE_CONFIG.B.multiplier).toBe(2.0);
    expect(LEVEL_PACE_CONFIG.C.defaultPace).toBe(1);
    expect(LEVEL_PACE_CONFIG.C.multiplier).toBe(0.8);
  });

  it('correctly infers lessons per slot based on student level (A: 4, B: 2, C: 1)', () => {
    const paceA = inferStudentSubjectPace({ student: studentLevelA, subject: '算数' });
    expect(paceA.estimatedLessonsPerSlot).toBe(4);
    expect(paceA.reason).toContain('レベルA');

    const paceB = inferStudentSubjectPace({ student: studentLevelB, subject: '算数' });
    expect(paceB.estimatedLessonsPerSlot).toBe(2);
    expect(paceB.reason).toContain('レベルB');

    const paceC = inferStudentSubjectPace({ student: studentLevelC, subject: '算数' });
    expect(paceC.estimatedLessonsPerSlot).toBe(1);
    expect(paceC.reason).toContain('レベルC');
  });

  it('sets dynamic From-To lesson ranges according to student learning level', () => {
    // Level A (4 lessons range: STEP 1 to STEP 4)
    const rangeA = calculateLessonRangeForSlot({
      student: studentLevelA,
      subject: '算数',
      curriculumMasters: sampleMasters
    });
    expect(rangeA.start_lesson_name).toContain('STEP 1');
    expect(rangeA.end_lesson_name).toContain('STEP 4');

    // Level B (2 lessons range: STEP 1 to STEP 2)
    const rangeB = calculateLessonRangeForSlot({
      student: studentLevelB,
      subject: '算数',
      curriculumMasters: sampleMasters
    });
    expect(rangeB.start_lesson_name).toContain('STEP 1');
    expect(rangeB.end_lesson_name).toContain('STEP 2');

    // Level C (1 lesson range: STEP 1 to STEP 1)
    const rangeC = calculateLessonRangeForSlot({
      student: studentLevelC,
      subject: '算数',
      curriculumMasters: sampleMasters
    });
    expect(rangeC.start_lesson_name).toContain('STEP 1');
    expect(rangeC.end_lesson_name).toContain('STEP 1');
  });

  it('stops at unit test when lesson range encounters a unit test without overflowing into the next unit', () => {
    // STEP 4から開始した場合、4レッスン進むと STEP 4 -> STEP 5 -> 単元テスト -> 次単元STEP 1 となるが、単元テストでストップすること
    const studentNearTest: Student = {
      ...studentLevelA,
      completed_lesson_ids: ['cm-step1', 'cm-step2', 'cm-step3']
    };

    const range = calculateLessonRangeForSlot({
      student: studentNearTest,
      subject: '算数',
      curriculumMasters: sampleMasters
    });

    expect(range.start_lesson_name).toContain('STEP 4');
    expect(range.end_lesson_name).toContain('単元確認テスト');
    expect(range.end_lesson_name).not.toContain('小数のわり算');
  });

  it('renders elementary milestone timeline with level-based pace calculation in TeacherDashboard', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          students={[studentLevelA]}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={studentLevelA.id}
          initialTab="milestones"
        />
      );
    });

    expect(screen.getByText(/消化ペース: 週約/)).toBeInTheDocument();
    expect(screen.getByText(/全単元完了の推定予定日/)).toBeInTheDocument();
  });
});
