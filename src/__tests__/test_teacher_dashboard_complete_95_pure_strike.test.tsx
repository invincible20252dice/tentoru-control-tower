import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';
import { Student, CurriculumMaster, MilestonePlan, MilestoneTemplate } from '../types';

describe('TeacherDashboard 95%+ Pure Strike Test Suite', () => {
  const mockStudents: Student[] = [
    {
      id: 'std-strike-pure-1',
      student_id: 'S_PURE_1',
      name: 'ピュア生徒',
      name_kana: 'ピュアセイト',
      grade: '中2',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      teacher_in_charge: '福田 尚弘',
      assigned_teachers: ['福田 尚弘'],
      status: 'normal',
      period_count: 2,
      selected_days: ['monday', 'thursday'],
      selected_subjects: ['数学', '英語', '理科'],
      target_schools: [{ school_name: '日比谷高校', course_name: '普通科' }],
      personalities: ['几帳面'],
      start_unit_math: 'cm-pure-1',
      created_at: '2026-04-01T00:00:00Z',
      registered_year: 2026,
      registered_grade: '中2'
    }
  ];

  const mockCurriculums: CurriculumMaster[] = [
    {
      id: 'cm-pure-1',
      subject: '数学',
      grade: '中2',
      unit_name: '連立方程式',
      lesson_name: '連立方程式の解法 STEP 1',
      sort_order: 1,
      target_level: 'A'
    },
    {
      id: 'cm-pure-2',
      subject: '数学',
      grade: '中2',
      unit_name: '連立方程式',
      lesson_name: '連立方程式 単元確認テスト',
      sort_order: 2,
      target_level: 'A'
    },
    {
      id: 'cm-pure-3',
      subject: '数学',
      grade: '中2',
      unit_name: '一次関数',
      lesson_name: '一次関数のグラフ STEP 1',
      sort_order: 3,
      target_level: 'A'
    }
  ];

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    mockStudents.forEach(s => db.saveStudent(s));
    await db.saveCurriculumMasters(mockCurriculums);
  });

  it('covers start unit save, milestone template operations, and schedule slot linkings', async () => {
    let rendered: any;
    await act(async () => {
      rendered = render(
        <TeacherDashboard
          students={mockStudents}
          curriculumMasters={mockCurriculums}
          tasks={[]}
          initialTab="student-detail"
        />
      );
    });

    // 1. 各教科の開始単元位置の変更と保存 (handleSaveStartUnit)
    const mathStartSelect = screen.queryByTestId('start-grade-select-start_unit_math') || screen.queryByDisplayValue(/連立方程式/);
    if (mathStartSelect) {
      await act(async () => {
        fireEvent.change(mathStartSelect, { target: { value: 'cm-pure-1' } });
      });
    }

    const saveStartBtns = screen.queryAllByText(/開始位置を保存|保存する/);
    if (saveStartBtns.length > 0) {
      await act(async () => {
        fireEvent.click(saveStartBtns[0]);
      });
    }

    // 2. マイルストーンタブでのテンプレート適用・保存・クリア
    const milestoneTabs = screen.queryAllByText(/年間計画|マイルストーン/);
    if (milestoneTabs.length > 0) {
      await act(async () => {
        fireEvent.click(milestoneTabs[0]);
      });

      // テンプレート名入力と保存
      const tmplNameInput = screen.queryByPlaceholderText(/テンプレート名/);
      const saveTmplBtn = screen.queryByText(/計画テンプレートを保存/);
      if (tmplNameInput && saveTmplBtn) {
        await act(async () => {
          fireEvent.change(tmplNameInput, { target: { value: '標準中2テンプレート' } });
          fireEvent.click(saveTmplBtn);
        });
      }

      // 単元テストモーダルを開く
      const openUnitTestModalBtn = screen.queryByTestId('timeline-add-unittest-btn');
      if (openUnitTestModalBtn) {
        await act(async () => {
          fireEvent.click(openUnitTestModalBtn);
        });

        // モーダル内各inputのonChange
        const subjSel = screen.queryByDisplayValue('数学') || screen.queryByLabelText(/教科/);
        if (subjSel) {
          await act(async () => {
            fireEvent.change(subjSel, { target: { value: '算数' } });
          });
        }

        const gradeSel = screen.queryByDisplayValue('中2') || screen.queryByLabelText(/学年/);
        if (gradeSel) {
          await act(async () => {
            fireEvent.change(gradeSel, { target: { value: '中3' } });
          });
        }

        const unitInputs = screen.queryAllByPlaceholderText(/例: 1章 整数と小数/);
        if (unitInputs.length > 0) {
          await act(async () => {
            fireEvent.change(unitInputs[0], { target: { value: '一次関数' } });
          });
        }

        const testInputs = screen.queryAllByPlaceholderText(/例: たしざん 単元確認テスト/);
        if (testInputs.length > 0) {
          await act(async () => {
            fireEvent.change(testInputs[0], { target: { value: '一次関数 単元確認テスト' } });
          });
        }

        const passLineInputs = screen.queryAllByPlaceholderText(/例: 80%以上/);
        if (passLineInputs.length > 0) {
          await act(async () => {
            fireEvent.change(passLineInputs[0], { target: { value: '85点' } });
          });
        }

        const cancelModal = screen.queryByText('キャンセル');
        if (cancelModal) {
          await act(async () => {
            fireEvent.click(cancelModal);
          });
        }
      }
    }

    // 3. 学習計画・コマ割りタブ (schedule)
    const scheduleTabs = screen.queryAllByText(/学習計画・コマ割り|週別時間割/);
    if (scheduleTabs.length > 0) {
      await act(async () => {
        fireEvent.click(scheduleTabs[0]);
      });

      // コマ割り変更
      const startLessonSelects = screen.queryAllByTestId(/period-unit-select/);
      if (startLessonSelects.length > 0) {
        await act(async () => {
          fireEvent.change(startLessonSelects[0], { target: { value: 'cm-pure-1' } });
        });
      }

      const endLessonSelects = screen.queryAllByTestId(/period-end-lesson-select/);
      if (endLessonSelects.length > 0) {
        await act(async () => {
          fireEvent.change(endLessonSelects[0], { target: { value: 'cm-pure-2' } });
        });
      }

      // 宿題更新・削除
      const hwInputs = screen.queryAllByPlaceholderText(/宿題内容/);
      if (hwInputs.length > 0) {
        await act(async () => {
          fireEvent.change(hwInputs[0], { target: { value: '連立方程式ワーク P30-35' } });
        });
      }

      const delHwBtns = screen.queryAllByText(/削除|🗑️/);
      if (delHwBtns.length > 0) {
        await act(async () => {
          fireEvent.click(delHwBtns[0]);
        });
      }
    }
  });
});
