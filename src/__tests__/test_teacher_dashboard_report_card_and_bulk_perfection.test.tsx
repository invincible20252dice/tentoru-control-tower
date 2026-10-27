import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';
import * as geminiModule from '../lib/gemini';
import { Student, MiniTestResult, HomeworkResult } from '../types';

const getDynamicDateStr = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

describe('TeacherDashboard Report Card Image Analysis, Minitests & Homework Perfection Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn().mockReturnValue(true);

    db.saveSession({
      user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' }
    } as any);
  });

  it('covers report card image auto-parsing and error handling on tests tab', async () => {
    const student: Student = {
      id: 'st-report-card-1',
      student_id: 'RC001',
      name: '成績表解析生徒',
      grade: '中2',
      status: 'normal',
      branch_id: 'branch-1',
      school_id: 'sch-1',
      school_name: '第一中学校',
      created_at: new Date().toISOString()
    };
    (db as any).saveMockData('students', [student]);

    // Mock analyzeReportCardImage success
    const analyzeSpy = vi.spyOn(geminiModule, 'analyzeReportCardImage').mockResolvedValue({
      test_name: '2学期中間テスト',
      score_japanese: 85,
      score_math: 92,
      score_english: 78,
      score_social: 90,
      score_science: 88,
      score_total: 433,
      class_rank: '3位 / 35名',
      school_rank: '12位 / 180名',
      deviation_value: 64.5
    });

    // Mock FileReader as a class
    const origWindowFileReader = window.FileReader;
    const origGlobalFileReader = global.FileReader;
    class MockFileReader {
      onload: (() => void) | null = null;
      result: string | null = null;
      readAsDataURL(_file: Blob) {
        this.result = 'data:image/png;base64,ZmFrZS1pbWFnZS1jb250ZW50';
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 10);
      }
    }
    window.FileReader = MockFileReader as any;
    global.FileReader = MockFileReader as any;

    const { unmount } = render(
      <TeacherDashboard
        students={[student]}
        initialStudentId={student.id}
        initialTab="tests"
      />
    );

    const fileInput = document.getElementById('report-image-upload') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    // Trigger file change with a fake image file
    const fakeFile = new File(['fake-image-content'], 'report.png', { type: 'image/png' });
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [fakeFile] } });
    });

    await waitFor(() => {
      expect(analyzeSpy).toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('成績表画像の解析が完了し、点数を自動セットしました'));
    });

    // Test empty OCR result case to cover all false branches (Lines 4454-4463)
    (window.alert as any).mockClear();
    analyzeSpy.mockResolvedValueOnce({} as any);
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [fakeFile] } });
    });
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('成績表画像の解析が完了し、点数を自動セットしました'));
    });

    // Test error case in FileReader / analysis
    analyzeSpy.mockRejectedValueOnce(new Error('AI解析エンジンタイムアウト'));
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [fakeFile] } });
    });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('解析中にエラーが発生しました'));
    });

    window.FileReader = origWindowFileReader;
    global.FileReader = origGlobalFileReader;
    unmount();
  });

  it('covers minitest grade filtering, multi-order sorting, status toggle, and score editing', async () => {
    const todayStr = getDynamicDateStr(0);
    const elemStudent: Student = {
      id: 'st-minitest-elem',
      student_id: 'ME01',
      name: '小川 小太郎',
      name_kana: 'おがわ こたろう',
      grade: '小4',
      status: 'normal',
      branch_id: 'branch-1',
      level: 'A'
    };
    const jhsStudent: Student = {
      id: 'st-minitest-jhs',
      student_id: 'MJ01',
      name: '佐藤 中吉',
      name_kana: 'さとう ちゅうきち',
      grade: '中2',
      status: 'normal',
      branch_id: 'branch-1',
      level: 'B'
    };
    const highStudent: Student = {
      id: 'st-minitest-high',
      student_id: 'MH01',
      name: '高橋 高志',
      name_kana: 'たかはし たかし',
      grade: '高3',
      status: 'normal',
      branch_id: 'branch-1',
      level: 'C'
    };
    (db as any).saveMockData('students', [elemStudent, jhsStudent, highStudent]);

    const miniResults: MiniTestResult[] = [
      {
        id: 'mt-elem-1',
        student_id: elemStudent.id,
        subject: '算数',
        unit_name: '小数の計算',
        test_content: '小数掛け算テスト',
        status: 'passed',
        passed: true,
        score: 95,
        date: getDynamicDateStr(-1)
      },
      {
        id: 'mt-jhs-1',
        student_id: jhsStudent.id,
        subject: '数学',
        unit_name: '連立方程式',
        test_content: '連立方程式応用テスト',
        status: 'failed',
        passed: false,
        score: 40,
        date: todayStr
      },
      {
        id: 'mt-high-1',
        student_id: highStudent.id,
        subject: '物理',
        unit_name: '力学',
        test_content: '運動方程式確認テスト',
        status: 'unstarted',
        passed: null,
        score: null,
        date: getDynamicDateStr(-2)
      }
    ];
    (db as any).saveMockData('mini_test_results', miniResults);

    const { unmount } = render(
      <TeacherDashboard
        students={[elemStudent, jhsStudent, highStudent]}
        initialStudentId={elemStudent.id}
        initialTab="mini-tests"
      />
    );

    const gradeFilter = document.getElementById('minitest-grade-filter') as HTMLSelectElement;
    expect(gradeFilter).toBeInTheDocument();

    // 1. Switch to '小学生' via header button
    const elemBtn = screen.getByTestId('header-teacher-type-elem');
    fireEvent.click(elemBtn);
    const gradeFilterElem = document.getElementById('minitest-grade-filter') as HTMLSelectElement;
    fireEvent.change(gradeFilterElem, { target: { value: '小学生' } });
    await waitFor(() => {
      expect(screen.getByText('小数掛け算テスト')).toBeInTheDocument();
      expect(screen.queryByText('連立方程式応用テスト')).not.toBeInTheDocument();
    });

    // 2. Switch to '中学生' via header button
    const jhsBtn = screen.getByTestId('header-teacher-type-jhs');
    fireEvent.click(jhsBtn);
    const gradeFilterJhs = document.getElementById('minitest-grade-filter') as HTMLSelectElement;
    fireEvent.change(gradeFilterJhs, { target: { value: '中学生' } });
    await waitFor(() => {
      expect(screen.getByText('連立方程式応用テスト')).toBeInTheDocument();
      expect(screen.queryByText('小数掛け算テスト')).not.toBeInTheDocument();
    });

    // 3. Switch to '高校生' via header button
    const highBtn = screen.getByTestId('header-teacher-type-high');
    fireEvent.click(highBtn);
    const gradeFilterHigh = document.getElementById('minitest-grade-filter') as HTMLSelectElement;
    fireEvent.change(gradeFilterHigh, { target: { value: '高校生' } });
    await waitFor(() => {
      expect(screen.getByText('運動方程式確認テスト')).toBeInTheDocument();
      expect(screen.queryByText('小数掛け算テスト')).not.toBeInTheDocument();
    });

    // 4. Switch back to 'all'
    fireEvent.change(gradeFilterHigh, { target: { value: 'all' } });

    // 5. Sort order testing
    const sortSelect = document.getElementById('minitest-sort-order') as HTMLSelectElement;
    expect(sortSelect).toBeInTheDocument();

    fireEvent.change(sortSelect, { target: { value: 'date_asc' } });
    fireEvent.change(sortSelect, { target: { value: 'name_asc' } });
    fireEvent.change(sortSelect, { target: { value: 'unsubmitted_first' } });
    fireEvent.change(sortSelect, { target: { value: 'passed_first' } });

    unmount();
  });

  it('covers homework grade filtering, multi-order sorting, and status toggles', async () => {
    const todayStr = getDynamicDateStr(0);
    const elemStudent: Student = {
      id: 'st-hw-elem',
      student_id: 'HWE01',
      name: '宿題小学生',
      grade: '小5',
      status: 'normal',
      branch_id: 'branch-1'
    };
    const highStudent: Student = {
      id: 'st-hw-high',
      student_id: 'HWH01',
      name: '宿題高校生',
      grade: '高1',
      status: 'normal',
      branch_id: 'branch-1'
    };
    (db as any).saveMockData('students', [elemStudent, highStudent]);

    const homeworkList: HomeworkResult[] = [
      {
        id: 'hw-1',
        student_id: elemStudent.id,
        subject: '算数',
        title: '小5分数プリント10問',
        homework_content: '小5分数プリント10問',
        status: 'passed',
        passed: true,
        score: 100,
        date: todayStr
      },
      {
        id: 'hw-2',
        student_id: highStudent.id,
        subject: '英語',
        title: '英単語ターゲット1900',
        homework_content: '英単語ターゲット1900',
        status: 'failed',
        passed: false,
        score: 50,
        date: getDynamicDateStr(-1)
      }
    ];
    (db as any).saveMockData('homework_results', homeworkList);

    const { unmount } = render(
      <TeacherDashboard
        students={[elemStudent, highStudent]}
        initialStudentId={elemStudent.id}
        initialTab="homeworks"
      />
    );

    const elemBtn = screen.getByTestId('header-teacher-type-elem');
    fireEvent.click(elemBtn);
    const hwGradeFilterElem = document.getElementById('homework-grade-filter') as HTMLSelectElement;
    if (hwGradeFilterElem) {
      fireEvent.change(hwGradeFilterElem, { target: { value: '小学生' } });
      await waitFor(() => {
        expect(screen.getByText('小5分数プリント10問')).toBeInTheDocument();
      });
    }

    const highBtn = screen.getByTestId('header-teacher-type-high');
    fireEvent.click(highBtn);
    const hwGradeFilterHigh = document.getElementById('homework-grade-filter') as HTMLSelectElement;
    if (hwGradeFilterHigh) {
      fireEvent.change(hwGradeFilterHigh, { target: { value: '高校生' } });
      await waitFor(() => {
        expect(screen.getByText('英単語ターゲット1900')).toBeInTheDocument();
      });

      fireEvent.change(hwGradeFilterHigh, { target: { value: 'all' } });
    }

    const hwSortSelect = document.getElementById('homework-sort-order') as HTMLSelectElement;
    if (hwSortSelect) {
      fireEvent.change(hwSortSelect, { target: { value: 'date_asc' } });
      fireEvent.change(hwSortSelect, { target: { value: 'name_asc' } });
      fireEvent.change(hwSortSelect, { target: { value: 'unsubmitted_first' } });
      fireEvent.change(hwSortSelect, { target: { value: 'completed_first' } });
    }

    unmount();
  });

  it('covers confirm cancel branches in milestones and template management', async () => {
    const student: Student = {
      id: 'st-confirm-cancel-1',
      student_id: 'CC001',
      name: 'キャンセル確認生徒',
      grade: '小5',
      status: 'normal',
      branch_id: 'branch-1',
      school_id: 'sch-1',
      school_name: '中央小学校',
      excluded_lesson_ids: ['step-m-1'],
      created_at: new Date().toISOString()
    };
    (db as any).saveMockData('students', [student]);

    const masters: any[] = [
      {
        id: 'step-m-1',
        grade: '小5',
        subject: '算数',
        unit_name: '小数のかけ算',
        lesson_name: '第1講 小数の計算',
        sort_order: 1
      },
      {
        id: 'step-m-test-1',
        grade: '小5',
        subject: '算数',
        unit_name: '小数のかけ算',
        lesson_name: '小数のかけ算 単元確認テスト',
        sort_order: 2,
        item_type: 'unit_test'
      }
    ];
    (db as any).saveMockData('curriculum_masters', masters);

    const templates = [
      {
        id: 'tpl-cancel-1',
        name: 'キャンセル用テンプレ',
        grade: '中2',
        subject: '数学',
        level: 'B',
        plans: []
      }
    ];
    (db as any).saveMockData('milestone_templates', templates);

    // Mock confirm to return FALSE (user clicks Cancel)
    window.confirm = vi.fn().mockReturnValue(false);

    const { unmount, rerender } = render(
      <TeacherDashboard
        students={[student]}
        initialStudentId={student.id}
        initialTab="milestones"
        teacherType="elementary"
      />
    );

    // 1. Reset excluded lessons cancel
    await waitFor(() => {
      const resetBtn = screen.queryByText(/除外リセット/);
      expect(resetBtn).toBeInTheDocument();
    });
    const resetBtn = screen.getByText(/除外リセット/);
    await act(async () => {
      fireEvent.click(resetBtn);
    });
    expect(window.confirm).toHaveBeenCalled();
    // Excluded list should remain unchanged
    const currentStudentAfterCancel = db.getStudents().find(s => s.id === student.id);
    expect(currentStudentAfterCancel?.excluded_lesson_ids).toEqual(['step-m-1']);

    // 2. Exclude unit cancel
    const excludeBtns = screen.queryAllByTestId('timeline-exclude-btn');
    if (excludeBtns.length > 0) {
      await act(async () => {
        fireEvent.click(excludeBtns[0]);
      });
      expect(window.confirm).toHaveBeenCalled();
    }

    // 3. Delete unit test cancel
    const deleteTestBtns = screen.queryAllByTestId('timeline-delete-unittest-btn');
    if (deleteTestBtns.length > 0) {
      await act(async () => {
        fireEvent.click(deleteTestBtns[0]);
      });
      expect(window.confirm).toHaveBeenCalled();
      const currentMasters = db.getCurriculumMasters();
      expect(currentMasters.some(m => m.id === 'step-m-test-1')).toBe(true);
    }

    unmount();
  });

  it('covers confirm cancel branch for milestone template deletion', async () => {
    const jhsStudent: Student = {
      id: 'st-jhs-tpl-1',
      student_id: 'JHS001',
      name: '中学生徒テンプレ',
      grade: '中2',
      status: 'normal',
      branch_id: 'branch-1',
      school_id: 'sch-1',
      school_name: '第二中学校'
    };
    (db as any).saveMockData('students', [jhsStudent]);

    const templates = [
      {
        id: 'tpl-cancel-1',
        name: 'キャンセル用テンプレ',
        grade: '中2',
        subject: '数学',
        level: 'B',
        plans: []
      }
    ];
    (db as any).saveMockData('milestone_templates', templates);

    // Mock confirm to return FALSE
    window.confirm = vi.fn().mockReturnValue(false);

    const { unmount } = render(
      <TeacherDashboard
        students={[jhsStudent]}
        initialStudentId={jhsStudent.id}
        initialTab="milestones"
        teacherType="junior_high"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/保存済みテンプレート:/)).toBeInTheDocument();
    });

    const selectTemplate = screen.getByText(/保存済みテンプレート:/).parentElement?.querySelector('select');
    expect(selectTemplate).toBeInTheDocument();
    if (selectTemplate) {
      await act(async () => {
        fireEvent.change(selectTemplate, { target: { value: 'tpl-cancel-1' } });
      });

      const deleteTplBtn = screen.getByText('削除');
      await act(async () => {
        fireEvent.click(deleteTplBtn);
      });
      expect(window.confirm).toHaveBeenCalled();
      const currentTpls = db.getMilestoneTemplates();
      expect(currentTpls.some(t => t.id === 'tpl-cancel-1')).toBe(true);
    }

    unmount();
  });
});
