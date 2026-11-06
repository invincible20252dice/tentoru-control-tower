import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, LearningTask, CurriculumMaster } from '../lib/db';
import TeacherDashboard, {
  findPendingUnitTestForPeriodOrSubject,
  extractUnitTestsFromPeriodSelections
} from '../components/TeacherDashboard';
import { ensureMathEnglishUnitTests } from '../lib/scheduler';

describe('小学生カリキュラムにおける単元確認テストの「本日のテスト」自動反映テスト', () => {
  const sampleMasters: CurriculumMaster[] = [
    { id: 'cm-算数-小1-1', subject: '算数', grade: '小1', unit_name: 'かずと　すうじ', lesson_name: 'かずとすうじ', sort_order: 1, item_type: 'lesson' },
    { id: 'cm-算数-小1-2', subject: '算数', grade: '小1', unit_name: 'なんばんめ', lesson_name: 'なんばんめ(1)', sort_order: 2, item_type: 'lesson' }
  ];

  const sampleStudent: Student = {
    id: 'std-b-1',
    student_id: 'student43854',
    name: '佐藤　B',
    grade: '小3',
    level: 'B',
    school_id: 'sch-1',
    branch_id: 'branch-1',
    period_count: 2,
    selected_days: ['tuesday', 'friday'],
    selected_subjects: ['算数', '英語'],
    start_unit_math: 'cm-算数-小1-1',
    completed_lesson_ids: []
  };

  beforeEach(async () => {
    localStorage.clear();
    await db.saveCurriculumMasters(sampleMasters);
    await db.saveStudent(sampleStudent);
  });

  it('1. findPendingUnitTestForPeriodOrSubject: 単元名またはレッスンから未合格の単元確認テストを正しく特定できること', () => {
    const processed = ensureMathEnglishUnitTests(sampleMasters);
    const result = findPendingUnitTestForPeriodOrSubject({
      subject: '算数',
      unitName: 'かずと　すうじ',
      student: sampleStudent,
      curriculumMasters: processed
    });

    expect(result).not.toBeNull();
    expect(result?.unitName).toBe('かずと　すうじ');
    expect(result?.content).toBe('かずと　すうじ - 単元確認テスト');
    expect(result?.passingLine).toBe('80%以上');
  });

  it('2. extractUnitTestsFromPeriodSelections: コマ割りがまとめテスト(3)まででも、単元確認テストが自動抽出されること', () => {
    const processed = ensureMathEnglishUnitTests(sampleMasters);
    const periodSelections = {
      1: {
        subject: '算数',
        unitId: 'cm-算数-小1-1',
        startLessonId: 'cm-算数-小1-1',
        startLessonName: 'かずと　すうじ - かずとすうじ',
        endLessonId: 'cm-auto-sum3-算数-小1-かずと　すうじ',
        endLessonName: 'かずと　すうじ - まとめテスト（３）',
        lessonRange: 'かずと　すうじ - かずとすうじ 〜 かずと　すうじ - まとめテスト（３）'
      }
    };

    const extracted = extractUnitTestsFromPeriodSelections({
      periodSelections,
      periodCount: 1,
      curriculumMasters: processed,
      student: sampleStudent
    });

    expect(extracted.length).toBeGreaterThan(0);
    const mathTest = extracted.find(t => t.subject === '算数');
    expect(mathTest).toBeDefined();
    expect(mathTest?.content).toBe('かずと　すうじ - 単元確認テスト');
    expect(mathTest?.unitName).toBe('かずと　すうじ');
  });

  it('3. UIテスト: コマ割りに算数が設定された日付で「本日のテスト」に単元確認テストが自動反映されること', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const today = new Date().toISOString().split('T')[0];

    // 当日のタスクとして算数（かずと　すうじ）を設定
    const task: LearningTask = {
      id: `task-${sampleStudent.id}-${today}-1`,
      student_id: sampleStudent.id,
      scheduled_date: today,
      period: 1,
      subject: '算数',
      unit_id: 'cm-算数-小1-1',
      start_lesson_id: 'cm-算数-小1-1',
      end_lesson_id: 'cm-auto-sum3-算数-小1-かずと　すうじ',
      start_lesson_name: 'かずと　すうじ - かずとすうじ',
      end_lesson_name: 'かずと　すうじ - まとめテスト（３）',
      status: 'unstarted',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);

    await act(async () => {
      render(
        <TeacherDashboard 
          initialStudentId={sampleStudent.id} 
          teacherType="elementary" 
          initialTab="schedule" 
        />
      );
    });

    // 「遅れチェック ＆ 自動リスケ」ボタンをクリック
    const autoReschedBtn = await screen.findByRole('button', { name: /遅れチェック ＆ 自動リスケ/i });
    await act(async () => {
      fireEvent.click(autoReschedBtn);
    });

    // 本日のテスト枠に「かずと　すうじ - 単元確認テスト」が自動反映されていることを検証
    await waitFor(() => {
      expect(screen.getAllByText(/かずと.*すうじ.*単元確認テスト/i).length).toBeGreaterThan(0);
    });
  });

  it('4. UIテスト: コマ割りのドロップダウンに単元確認テストが表示され、選択時に専用スタイル・バッジが適用されること', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    await act(async () => {
      render(
        <TeacherDashboard 
          initialStudentId={sampleStudent.id} 
          teacherType="elementary" 
          initialTab="schedule" 
        />
      );
    });

    // 1コマ目の教科を「算数」に変更
    const subjSelect = await screen.findByTestId('period-subject-select-1');
    await act(async () => {
      fireEvent.change(subjSelect, { target: { value: '算数' } });
    });

    // 開始授業のドロップダウンに単元確認テストが含まれていること
    const startSelect = await screen.findByTestId('period-unit-select-1');
    const options = Array.from(startSelect.querySelectorAll('option')).map(o => o.textContent || '');
    const hasUnitTestOption = options.some(opt => opt.includes('単元確認テスト') || opt.includes('単元テスト'));
    expect(hasUnitTestOption).toBe(true);

    // 単元確認テストのoptionのvalueを取得して選択
    const utOption = Array.from(startSelect.querySelectorAll('option')).find(o => o.textContent?.includes('単元確認テスト'));
    expect(utOption).toBeDefined();

    if (utOption) {
      await act(async () => {
        fireEvent.change(startSelect, { target: { value: utOption.value } });
      });

      // 単元確認テスト実施コマバッジが表示されること
      await waitFor(() => {
        expect(screen.getByTestId('period-unittest-badge-1')).toBeInTheDocument();
      });

      // コマ割り行（period-row-1）にパープル背景が適用されていること
      const row = screen.getByTestId('period-row-1');
      expect(row.style.backgroundColor).toBe('rgb(250, 245, 255)');
    }
  });
});
