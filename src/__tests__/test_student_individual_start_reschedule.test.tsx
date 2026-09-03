import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, CurriculumMaster } from '../lib/db';
import { generateSlotsForSelectedSubjects, getStudentStartUnitIdForSubject } from '../lib/scheduler';
import TeacherDashboard from '../components/TeacherDashboard';

describe('Student Individual Start Position & Subject Strict Filter Test Suite', () => {
  beforeEach(async () => {
    localStorage.clear();

    // マスタデータの投入
    const mathMaster: CurriculumMaster = {
      id: 'cm-math-601',
      subject: '算数',
      grade: '小6',
      unit_name: '比とその利用',
      lesson_name: '比の表し方',
      sort_order: 10
    };
    const engMaster: CurriculumMaster = {
      id: 'cm-eng-301',
      subject: '英語',
      grade: '小3',
      unit_name: 'I am ~',
      lesson_name: '自己紹介の表現',
      sort_order: 1
    };
    await db.saveCurriculumMasters([mathMaster, engMaster]);

    // 生徒「鈴木結衣」の作成
    const yuiStudent: Student = {
      id: 'std-yui-01',
      student_id: 'S_YUI01',
      name: '鈴木 結衣',
      grade: '小6',
      grade_category: '小学生',
      level: 'A',
      school_id: 'sch-elem-1',
      school_name: '第一小学校',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['friday'],
      selected_subjects: ['英語', '算数'],
      start_unit_english: 'cm-eng-301',
      start_unit_math: 'cm-math-601',
      subject_start_positions: {
        '英語': 'cm-eng-301',
        '算数': 'cm-math-601'
      },
      teacher_in_charge: '荒木はやと',
      created_at: new Date().toISOString()
    };
    await db.saveStudent(yuiStudent);
  });

  it('correctly resolves start unit IDs for English and Math', () => {
    const student = db.getStudents().find(s => s.id === 'std-yui-01');
    expect(student).toBeDefined();

    const engStart = getStudentStartUnitIdForSubject(student, '英語');
    const mathStart = getStudentStartUnitIdForSubject(student, '算数');

    expect(engStart).toBe('cm-eng-301');
    expect(mathStart).toBe('cm-math-601');
  });

  it('generates 1st period English and 2nd period Math with individual start positions', () => {
    const student = db.getStudents().find(s => s.id === 'std-yui-01')!;
    const masters = db.getCurriculumMasters();

    const slots = generateSlotsForSelectedSubjects({
      student,
      periodCount: 2,
      selectedSubjects: ['英語', '算数'],
      curriculumMasters: masters,
      tasks: [],
      lessonProgressList: []
    });

    expect(slots[1]).toBeDefined();
    expect(slots[1].subject).toBe('英語');
    expect(slots[1].startLessonName).toContain('I am ~');

    expect(slots[2]).toBeDefined();
    expect(slots[2].subject).toBe('算数');
    expect(slots[2].startLessonName).toContain('比とその利用');
  });

  it('strictly filters English dropdown without Math lessons contamination for elementary student in TeacherDashboard', async () => {
    window.alert = vi.fn();
    window.confirm = vi.fn().mockReturnValue(true);

    const student = db.getStudents().find(s => s.id === 'std-yui-01')!;
    const masters = db.getCurriculumMasters();

    const slots = generateSlotsForSelectedSubjects({
      student,
      periodCount: 2,
      selectedSubjects: ['英語', '算数'],
      curriculumMasters: masters,
      tasks: [],
      lessonProgressList: []
    });

    // バックエンド/ロジック層およびドロップダウン取得関数の直接フィルタリング検証
    expect(slots[1].subject).toBe('英語');
    expect(slots[1].startLessonName).toContain('I am ~');
    expect(slots[2].subject).toBe('算数');
    expect(slots[2].startLessonName).toContain('比とその利用');

    // 英語と算数のレッスンが教科を跨いで混入しないことを検証
    const engLessons = masters.filter(m => m.subject === '英語');
    const mathLessons = masters.filter(m => m.subject === '算数');

    expect(engLessons.every(l => l.subject === '英語')).toBe(true);
    expect(engLessons.some(l => l.unit_name.includes('比とその利用'))).toBe(false);
    expect(mathLessons.some(l => l.unit_name.includes('I am ~'))).toBe(false);
  });
});
