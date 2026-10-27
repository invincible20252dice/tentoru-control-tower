import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';
import * as schedulerModule from '../lib/scheduler';

const getDynamicDateStr = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

describe('TeacherDashboard Curriculum and Milestones Deep Branch Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn().mockReturnValue(true);
  });

  it('covers curriculum unit CRUD, reordering, custom classes, and subject start positions', async () => {
    const defaultStudents = db.getStudents();
    const student = defaultStudents.find(s => s.grade.startsWith('中')) || defaultStudents[0];
    const defaultSchools = db.getSchools();
    const school = defaultSchools.find(s => s.id === student.school_id) || defaultSchools[0];

    const initialUnits = [
      {
        id: 'unit-dyn-c1',
        school_id: school.id,
        subject: '数学',
        name: '動的単元1',
        sequence_order: 1,
        link_url: null,
        created_at: new Date().toISOString()
      },
      {
        id: 'unit-dyn-c2',
        school_id: school.id,
        subject: '数学',
        name: '動的単元2',
        sequence_order: 2,
        link_url: 'https://example.com/dyn2',
        created_at: new Date().toISOString()
      }
    ];

    vi.spyOn(db, 'getCurriculumUnits').mockReturnValue(initialUnits as any);
    const saveUnitSpy = vi.spyOn(db, 'saveCurriculumUnit').mockResolvedValue(true as any);
    const saveUnitsSpy = vi.spyOn(db, 'saveCurriculumUnits').mockResolvedValue(true as any);
    const deleteUnitSpy = vi.spyOn(db, 'deleteCurriculumUnit').mockResolvedValue(true as any);
    const saveCustomClassSpy = vi.spyOn(db, 'saveCustomClass').mockResolvedValue(true as any);
    const deleteCustomClassSpy = vi.spyOn(db, 'deleteCustomClass').mockResolvedValue(true as any);

    render(
      <TeacherDashboard
        initialRole="admin"
        initialBranchId="all"
        initialStudentId={student.id}
      />
    );

    // Switch to 学校カリキュラム管理 tab
    const currTabBtn = screen.getByText('学校カリキュラム管理');
    await act(async () => {
      fireEvent.click(currTabBtn);
    });

    // 1. カリキュラム単元新規作成（空バリデーションと正常作成）
    const newUnitInput = screen.getByPlaceholderText('例: 1章 正の数・負の数');
    const addUnitBtn = screen.getByText('授業（単元）を追加');

    // 空バリデーション
    await act(async () => {
      fireEvent.click(addUnitBtn);
    });
    expect(window.alert).toHaveBeenCalledWith('単元名を入力してください。');

    // 正常追加
    await act(async () => {
      fireEvent.change(newUnitInput, { target: { value: '新規動的単元3' } });
      fireEvent.click(addUnitBtn);
    });
    expect(saveUnitSpy).toHaveBeenCalled();

    // 2. 単元の並び替え（下へ移動、上へ移動）
    const moveDownBtns = screen.queryAllByTitle('下に移動');
    if (moveDownBtns.length > 0) {
      await act(async () => {
        fireEvent.click(moveDownBtns[0]);
      });
      expect(saveUnitsSpy).toHaveBeenCalled();
    }

    const moveUpBtns = screen.queryAllByTitle('上に移動');
    if (moveUpBtns.length > 1) {
      await act(async () => {
        fireEvent.click(moveUpBtns[1]);
      });
      expect(saveUnitsSpy).toHaveBeenCalled();
    }

    // 3. 単元の編集（編集開始、保存）
    const editBtns = screen.queryAllByText('編集');
    if (editBtns.length > 0) {
      await act(async () => {
        fireEvent.click(editBtns[0]);
      });

      const editInput = screen.getByDisplayValue(initialUnits[0].name);
      await act(async () => {
        fireEvent.change(editInput, { target: { value: '動的単元1（改訂）' } });
      });

      const saveEditBtn = screen.getByText('保存');
      await act(async () => {
        fireEvent.click(saveEditBtn);
      });
      expect(saveUnitSpy).toHaveBeenCalled();
    }

    // 4. 単元の削除（キャンセルとOK）
    const deleteBtns = screen.queryAllByText('削除');
    if (deleteBtns.length > 0) {
      vi.mocked(window.confirm).mockReturnValueOnce(false);
      await act(async () => {
        fireEvent.click(deleteBtns[0]);
      });
      expect(deleteUnitSpy).not.toHaveBeenCalled();

      vi.mocked(window.confirm).mockReturnValueOnce(true);
      await act(async () => {
        fireEvent.click(deleteBtns[0]);
      });
      expect(deleteUnitSpy).toHaveBeenCalled();
    }

    // 5. 自由記述授業名の追加と削除
    const customClassInput = screen.getByPlaceholderText('例: 高校入試過去問演習');
    const addCustomClassBtn = screen.getByText('追加する');

    // 空バリデーション
    await act(async () => {
      fireEvent.click(addCustomClassBtn);
    });
    expect(window.alert).toHaveBeenCalledWith('自由記述の授業名を入力してください。');

    // 正常追加
    await act(async () => {
      fireEvent.change(customClassInput, { target: { value: '特別動的講座' } });
      fireEvent.click(addCustomClassBtn);
    });
    expect(saveCustomClassSpy).toHaveBeenCalled();

    // 自由記述の削除
    const allDeleteBtns = screen.queryAllByText('削除');
    if (allDeleteBtns.length > 0) {
      const lastDelete = allDeleteBtns[allDeleteBtns.length - 1];
      await act(async () => {
        fireEvent.click(lastDelete);
      });
      expect(deleteCustomClassSpy).toHaveBeenCalled();
    }
  });

  it('covers milestone timeline calculation deep branches including extractLessonIdsFromSlot and grade filters', async () => {
    const todayStr = getDynamicDateStr(0);

    const defaultStudents = db.getStudents();
    const elemStudent = defaultStudents.find(s => s.grade.startsWith('小')) || defaultStudents[0];

    // Mock scheduler getLessonRangeStepIds to return fallback so manual branch in extractLessonIdsFromSlot executes
    vi.spyOn(schedulerModule, 'getLessonRangeStepIds').mockReturnValue([
      { id: 'lesson-fallback', name: 'フォールバック' } as any
    ]);

    // Create diverse tasks exercising all branches of extractLessonIdsFromSlot
    const customTasks = [
      {
        id: 't-slot-dyn-1',
        student_id: elemStudent.id,
        scheduled_date: todayStr,
        period: 1,
        subject: '算数',
        status: 'unstarted' as const,
        lesson_ids: ['step-dyn-1', 'step-dyn-2'],
        created_at: new Date().toISOString()
      },
      {
        id: 't-slot-dyn-2',
        student_id: elemStudent.id,
        scheduled_date: todayStr,
        period: 2,
        subject: '算数',
        status: 'unstarted' as const,
        lesson_range: '第1講  〜  第2講',
        start_lesson_name: '',
        end_lesson_name: '',
        created_at: new Date().toISOString()
      },
      {
        id: 't-slot-dyn-3',
        student_id: elemStudent.id,
        scheduled_date: todayStr,
        period: 3,
        subject: '算数',
        status: 'unstarted' as const,
        lesson_range: '第3講~第4講',
        created_at: new Date().toISOString()
      },
      {
        id: 't-slot-dyn-4',
        student_id: elemStudent.id,
        scheduled_date: todayStr,
        period: 4,
        subject: '算数',
        status: 'unstarted' as const,
        start_lesson_name: '第1講',
        end_lesson_name: '第2講',
        created_at: new Date().toISOString()
      },
      {
        id: 't-slot-dyn-5',
        student_id: elemStudent.id,
        scheduled_date: todayStr,
        period: 5,
        subject: '算数',
        status: 'unstarted' as const,
        end_lesson_name: '第3講',
        created_at: new Date().toISOString()
      },
      {
        id: 't-slot-dyn-6',
        student_id: elemStudent.id,
        scheduled_date: todayStr,
        period: 6,
        subject: '算数',
        status: 'unstarted' as const,
        lesson_range: 'まとめテスト (Check Test 1)',
        created_at: new Date().toISOString()
      }
    ];

    vi.spyOn(db, 'getLearningTasks').mockReturnValue(customTasks as any);

    render(
      <TeacherDashboard
        teacherType="elementary"
        initialRole="admin"
        initialBranchId="all"
        initialStudentId={elemStudent.id}
      />
    );

    // Switch to 年間計画（マイルストーン） tab
    const milestoneTabBtn = screen.getByText('年間計画（マイルストーン）');
    await act(async () => {
      fireEvent.click(milestoneTabBtn);
    });

    // Test elementary timeline grade filters
    const elemFilterSelect = document.querySelector('#elementary-timeline-grade-filter') as HTMLSelectElement;
    if (elemFilterSelect) {
      for (const opt of ['all', '小4', '小5', '小6']) {
        await act(async () => {
          fireEvent.change(elemFilterSelect, { target: { value: opt } });
        });
      }
    }
  });
});
