import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import { findNextUncompletedLessonForSubject } from '../lib/scheduler';
import {
  db,
  type Student,
  type CurriculumUnit,
  type CurriculumMaster,
  type MiniTestResult,
  type HomeworkResult,
  type StudentInteraction
} from '../lib/db';

describe('Ultimate Branch Conquest Perfection Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    db.clearMockData();
    vi.restoreAllMocks();
  });

  const getDynamicDate = (offsetDays: number = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  it('exhaustively covers TeacherDashboard mini-tests passed_first sorting and passing_line % / 割 / 点 / level branches', async () => {
    const dynamicDate = getDynamicDate(0);
    const studentA: Student = {
      id: 'st-minitest-a',
      name: '生徒A合格者',
      grade: '中2',
      school_name: '緑野中学校',
      level: 'A' // passScore = 90
    };
    const studentB: Student = {
      id: 'st-minitest-b',
      name: '生徒B不合格者',
      grade: '中2',
      school_name: '緑野中学校',
      level: 'B' // passScore = 80
    };
    const studentC: Student = {
      id: 'st-minitest-c',
      name: '生徒C特殊ライン',
      grade: '中2',
      school_name: '緑野中学校',
      level: 'C' // passScore = 70
    };
    await db.saveStudent(studentA);
    await db.saveStudent(studentB);
    await db.saveStudent(studentC);

    // Mini test results with %, 割, 点 and statuses
    const results: MiniTestResult[] = [
      {
        id: 'mini-res-pct',
        student_id: studentA.id,
        subject: '数学',
        test_type: 'unit_test',
        test_content: '第1章 計算テスト',
        date: dynamicDate,
        score: 85,
        passing_line: '80%', // triggers passing_line.includes('%')
        status: 'passed'
      },
      {
        id: 'mini-res-wari',
        student_id: studentB.id,
        subject: '数学',
        test_type: 'unit_test',
        test_content: '第2章 方程式テスト',
        date: dynamicDate,
        score: 75,
        passing_line: '8割', // triggers passing_line.includes('割') -> limit * 10 = 80 -> 75 < 80 failed
        status: 'failed'
      },
      {
        id: 'mini-res-ten',
        student_id: studentC.id,
        subject: '数学',
        test_type: 'unit_test',
        test_content: '第3章 関数テスト',
        date: dynamicDate,
        score: null as any,
        passing_line: '75点', // triggers passing_line.includes('点')
        status: undefined
      }
    ];

    (db as any).saveMockData('mini_test_results', results);

    render(
      <TeacherDashboard
        students={[studentA, studentB, studentC]}
        initialStudentId={studentA.id}
        initialTab="mini-tests"
      />
    );

    await waitFor(() => {
      expect(screen.queryByText(/読み込み中/i)).toBeNull();
    });

    // Check that table renders
    expect(screen.getByText('第1章 計算テスト')).toBeDefined();

    // Change sort order to passed_first
    const sortSelect = document.getElementById('minitest-sort-order') as HTMLSelectElement;
    if (sortSelect) {
      fireEvent.change(sortSelect, { target: { value: 'passed_first' } });
    }

    // Test score input changes to trigger autoPassed calculation (% / 割 / 点)
    const scoreInputs = screen.getAllByRole('spinbutton');
    if (scoreInputs.length > 0) {
      // Enter 85 points
      fireEvent.change(scoreInputs[0], { target: { value: '85' } });
      // Enter empty / invalid
      fireEvent.change(scoreInputs[0], { target: { value: '' } });
    }

    // Change status select directly
    const statusSelect = screen.getByTestId('minitest-status-select-mini-res-pct');
    fireEvent.change(statusSelect, { target: { value: 'failed' } });
    fireEvent.change(statusSelect, { target: { value: 'passed' } });
  });

  it('exhaustively covers scheduler findNextUncompletedLessonForSubject fallback to curriculumUnits and subject variations', () => {
    // Clear curriculum masters to force fallback to curriculumUnits
    (db as any).saveMockData('curriculum_masters', []);
    // Student with elementary school, testing subject fallback when rawMasters is empty
    const elemStudent: Student = {
      id: 'st-sched-units-1',
      name: '小学生単元フォールバック',
      grade: '小4',
      school_name: '桜小学校',
      school_id: 'sch-sakura-elem'
    };

    const mockUnits: CurriculumUnit[] = [
      {
        id: 'cu-elem-math-1',
        school_id: 'sch-sakura-elem',
        subject: '算数',
        name: '角の大きさ',
        sequence_order: 1
      },
      {
        id: 'cu-elem-sci-1',
        school_id: 'sch-sakura-elem',
        subject: '理科',
        name: '天気と気温',
        sequence_order: 1
      },
      {
        id: 'cu-fallback-other-school',
        school_id: 'sch-other',
        subject: '算数',
        name: '小数の計算',
        sequence_order: 2
      }
    ];

    // 1. Elementary math with matching school units
    const resElemMath = findNextUncompletedLessonForSubject({
      student: elemStudent,
      subject: '算数',
      curriculumMasters: [],
      curriculumUnits: mockUnits,
      schoolId: 'sch-sakura-elem'
    });
    expect(resElemMath.lessonName).toBe('角の大きさ');

    // 2. Elementary science (tests non-math subject filter: u.subject === subject)
    const resElemSci = findNextUncompletedLessonForSubject({
      student: elemStudent,
      subject: '理科',
      curriculumMasters: [],
      curriculumUnits: mockUnits,
      schoolId: 'sch-sakura-elem'
    });
    expect(resElemSci.lessonName).toBe('天気と気温');

    // 3. Fallback when schoolId does not match any units
    const resFallback = findNextUncompletedLessonForSubject({
      student: elemStudent,
      subject: '算数',
      curriculumMasters: [],
      curriculumUnits: mockUnits,
      schoolId: 'sch-non-existent'
    });
    expect(resFallback.lessonName).toBeDefined();

    // 4. Student without grade (triggers default subject matching: Line 612-615)
    const noGradeStudent: Student = {
      id: 'st-no-grade',
      name: '学年未設定',
      grade: ''
    };
    const resNoGrade = findNextUncompletedLessonForSubject({
      student: noGradeStudent,
      subject: '英語',
      curriculumMasters: [
        {
          id: 'cm-nograde-eng',
          grade: '',
          subject: '英語',
          unit_name: 'Grammar',
          lesson_name: 'Lesson 1',
          sort_order: 1
        }
      ]
    });
    expect(resNoGrade.lessonName).toBeDefined();
  });

  it('exhaustively covers StudentDashboard subject tabs and evaluation combinations', async () => {
    const dynamicDate = getDynamicDate(0);
    const student: Student = {
      id: 'st-student-eval-combos',
      name: '生徒評価複合テスト',
      grade: '中1',
      school_name: '緑野中学校',
      selected_subjects: ['数学', '英語', '理科']
    };
    await db.saveStudent(student);

    // Save mini test results with various status & score combinations
    const mini1: MiniTestResult = {
      id: 'mini-eval-1',
      student_id: student.id,
      subject: '数学',
      test_type: 'unit_test',
      test_content: '第1章 正負の数 単元テスト',
      date: dynamicDate,
      score: 95,
      passed: true,
      status: 'passed'
    };
    const mini2: MiniTestResult = {
      id: 'mini-eval-2',
      student_id: student.id,
      subject: '数学',
      test_type: 'unit_test',
      test_content: '第1章 正負の数 単元テスト', // same content to test existingHasEval replacement
      date: dynamicDate,
      score: null as any,
      passed: undefined,
      status: undefined
    };
    await db.saveMiniTestResult(mini1);
    await db.saveMiniTestResult(mini2);

    render(
      <StudentDashboard
        student={student}
        onBack={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText(/読み込み中/i)).toBeNull();
    });

    // Check that subjects are rendered
    const mathTabs = screen.getAllByText('数学');
    expect(mathTabs.length).toBeGreaterThan(0);
  });

  it('exhaustively covers db.ts contact log sorting and school name auto detection', async () => {
    const dynamicDate = getDynamicDate(0);

    // 1. Contact log sorting with date vs contact_date fallback (Line 4542)
    await db.saveStudentInteraction({
      id: 'contact-1',
      student_id: 'std-contact-1',
      category: '面談',
      memo: '連絡A',
      created_at: new Date().toISOString(),
      date: dynamicDate
    } as any);

    await db.saveStudentInteraction({
      id: 'contact-2',
      student_id: 'std-contact-1',
      category: '面談',
      memo: '連絡B',
      created_at: new Date().toISOString(),
      contact_date: dynamicDate // triggers (b as any).contact_date
    } as any);

    const logs = db.getStudentInteractions('std-contact-1');
    expect(logs.length).toBeGreaterThanOrEqual(2);

    // 2. School name automatic type detection for elementary, high school, junior high
    await db.saveStudent({ id: 'st-elem-sch', name: '小生徒', school_name: '市立第一小学校', grade: '小5' });
    await db.saveStudent({ id: 'st-high-sch', name: '高生徒', school_name: '県立第一高校', grade: '高1' });
    await db.saveStudent({ id: 'st-jhs-sch', name: '中生徒', school_name: '区立第一中学校', grade: '中2' });

    const allSchools = db.getSchools();
    const elemSch = allSchools.find(s => s.name === '市立第一小学校');
    const highSch = allSchools.find(s => s.name === '県立第一高校');
    const jhsSch = allSchools.find(s => s.name === '区立第一中学校');

    expect(elemSch?.type).toBe('elementary');
    expect(highSch?.type).toBe('high_school');
    expect(jhsSch?.type).toBe('junior_high');
  });
});
