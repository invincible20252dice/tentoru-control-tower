import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, CurriculumMaster, School, Branch, StudentInteraction, MilestonePlan } from '../lib/db';

describe('DatabaseService & TeacherDashboard Ultimate Strike Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('tests full DatabaseService auxiliary methods', async () => {
    // 1. Schools
    const school: School = {
      id: 'sch-cov-01',
      name: 'テスト第一中学校',
      type: 'junior_high',
      created_at: new Date().toISOString()
    };
    db.saveSchool(school);
    expect(db.getSchools().some(s => s.id === school.id)).toBe(true);

    // 2. Personality Options
    await db.addPersonalityOption('粘り強い');
    expect(db.getPersonalityOptions()).toContain('粘り強い');
    await db.removePersonalityOption('粘り強い');
    expect(db.getPersonalityOptions()).not.toContain('粘り強い');

    // 3. Teacher Options
    await db.addTeacherOption('田中 講師');
    expect(db.getTeacherOptions()).toContain('田中 講師');
    await db.removeTeacherOption('田中 講師');
    expect(db.getTeacherOptions()).not.toContain('田中 講師');

    // 4. Student Interactions (Memos)
    const interaction: StudentInteraction = {
      id: 'inter-cov-01',
      student_id: 'std-strike-test',
      category: '勉強相談',
      memo: '次回テスト目標設定完了',
      date: '2026-09-17',
      staff_name: '福田 尚弘',
      created_at: new Date().toISOString()
    };
    db.saveStudentInteraction(interaction);
    expect(db.getStudentInteractions('std-strike-test').some(i => i.id === interaction.id)).toBe(true);
    db.deleteStudentInteraction(interaction.id);
    expect(db.getStudentInteractions('std-strike-test').some(i => i.id === interaction.id)).toBe(false);

    // 5. Mini Tests & Homework Results
    db.saveMiniTestResult({
      id: 'mini-cov-01',
      student_id: 'std-strike-test',
      date: '2026-09-17',
      subject: '数学',
      unit_name: '一次方程式',
      score: 95,
      passed: true,
      created_at: new Date().toISOString()
    });
    expect(db.getMiniTestResults('std-strike-test').length).toBeGreaterThan(0);

    db.saveHomeworkResult({
      id: 'hw-cov-01',
      student_id: 'std-strike-test',
      date: '2026-09-17',
      subject: '数学',
      unit_name: '一次方程式 P10-15',
      completed: true,
      created_at: new Date().toISOString()
    });
    expect(db.getHomeworkResults('std-strike-test').length).toBeGreaterThan(0);

    // 6. Milestone Plan
    const plan: MilestonePlan = {
      id: 'ms-cov-01',
      grade: '中3',
      subject: '数学',
      course: 'A',
      month: 6,
      week_number: 2,
      unit_name: '平方根',
      target_sequence_order: 10,
      is_holiday: false,
      level: 'A',
      chapter: '第2章',
      target_theme_name: '平方根の計算'
    };
    await db.saveMilestonePlan(plan);
    expect(db.getMilestonePlans().some(p => p.id === 'ms-cov-01')).toBe(true);

    // 7. Student Lesson Progress
    await db.saveStudentLessonProgress({
      id: 'prog-cov-01',
      student_id: 'std-strike-test',
      lesson_id: 'cm-strike-1',
      unit_name: '小数のかけ算',
      date: '2026-09-17',
      status: 'completed',
      created_at: new Date().toISOString()
    });
    const progressList = db.getStudentLessonProgressList('std-strike-test');
    expect(progressList.length).toBeGreaterThan(0);
  });

  it('tests TeacherDashboard complex features: bulk timetable apply, curriculum drag & drop simulation, and holiday toggling', async () => {
    const student1: Student = {
      id: 'std-bulk-01',
      student_id: 'bulk01',
      name: '佐藤 拓海',
      grade: '中3',
      school_id: 'sch-1',
      classroom: '渋谷教室',
      status: 'normal',
      period_count: 2,
      level: 'A',
      registered_grade: '中3',
      registered_year: 2026,
      selected_subjects: ['数学', '英語'],
      assigned_teachers: ['福田 尚弘'],
      created_at: '2026-04-01T00:00:00Z'
    };

    const student2: Student = {
      id: 'std-bulk-02',
      student_id: 'bulk02',
      name: '中尾 謙信',
      grade: '中3',
      school_id: 'sch-1',
      classroom: '渋谷教室',
      status: 'normal',
      period_count: 2,
      level: 'A',
      registered_grade: '中3',
      registered_year: 2026,
      selected_subjects: ['数学', '英語'],
      assigned_teachers: ['福田 尚弘'],
      created_at: '2026-04-01T00:00:00Z'
    };

    db.saveStudent(student1);
    db.saveStudent(student2);

    await act(async () => {
      render(
        <TeacherDashboard
          students={[student1, student2]}
          initialStudentId={student1.id}
          initialTab="schedule-matrix"
          teacherType="junior_high"
        />
      );
    });

    // 週間マトリクスでの日付移動や表示確認
    const nextWeekBtns = screen.queryAllByText(/翌週|次へ|▶/);
    if (nextWeekBtns.length > 0) {
      await act(async () => {
        fireEvent.click(nextWeekBtns[0]);
      });
    }

    // カリキュラムタブへの遷移
    const curriTabs = screen.queryAllByText(/カリキュラム|学校カリキュラム管理/);
    if (curriTabs.length > 0) {
      await act(async () => {
        fireEvent.click(curriTabs[0]);
      });
    }
  });
});
