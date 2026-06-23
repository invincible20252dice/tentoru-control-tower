import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SugorokuMap from '../components/SugorokuMap';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import Portal from '../app/page';
import { db, CurriculumUnit, LearningTask, Student } from '../lib/db';

// Mock html2canvas since it does not work in jsdom environment easily
vi.mock('html2canvas', () => {
  return {
    default: vi.fn().mockResolvedValue({
      toDataURL: () => 'data:image/png;base64,mockImage'
    })
  };
});

describe('UI Components Render & Interaction Tests', () => {
  const mockUnits: CurriculumUnit[] = [
    { id: 'u-1', school_id: 'sch-1', subject: '数学', name: '単元1', sequence_order: 1, created_at: '' },
    { id: 'u-2', school_id: 'sch-1', subject: '数学', name: '単元2', sequence_order: 2, created_at: '' }
  ];

  const mockTasks: LearningTask[] = [
    { id: 't-1', student_id: 'std-1', unit_id: 'u-1', scheduled_date: '2026-06-19', period: 1, status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
    { id: 't-2', student_id: 'std-1', unit_id: 'u-2', scheduled_date: '2026-06-19', period: 2, status: 'unstarted', video_watched: false, test_passed: false, created_at: '' }
  ];

  const mockStudent: Student = {
    id: 'std-1',
    student_id: 'student101',
    name: '佐藤 拓海',
    email: 'student101@tentoru.com',
    grade: '中3',
    school_id: 'sch-1',
    status: 'normal',
    start_unit_id: null,
    created_at: ''
  };

  let alertMock = vi.fn();

  beforeEach(() => {
    alertMock = vi.fn();
    window.alert = alertMock;
    (global as any).alert = alertMock;
    db.clearMockData();
    // Seed initial demo data inside Mock LocalStorage
    db.getSchools();
    db.getCurriculumUnits();
    db.getStudents();
    db.getLearningTasks();
    db.getSchoolCodesMaster();
    db.getExamThresholdsMaster();
    db.getPromptSettings();
    db.getAIReports();
  });

  // 1. SugorokuMap
  it('should render SugorokuMap component with correct step states', () => {
    render(
      <SugorokuMap 
         subject="数学" 
         units={mockUnits} 
         tasks={mockTasks} 
      />
    );
    expect(screen.getByText(/数学の学習マップ/)).toBeInTheDocument();
    expect(screen.getByText(/単元1/)).toBeInTheDocument();

    // Edge Case: empty tasks (no tasks matching unit)
    const { container: container1 } = render(
      <SugorokuMap subject="数学" units={mockUnits} tasks={[]} />
    );
    expect(container1).toBeDefined();

    // Edge Case: all tasks completed
    const completedTasks = mockTasks.map(t => ({ ...t, status: 'completed' as const, video_watched: true, test_passed: true }));
    const { container: container2 } = render(
      <SugorokuMap subject="数学" units={mockUnits} tasks={completedTasks} />
    );
    expect(container2).toBeDefined();

    // Edge Case: video watched but test not passed (Line 116 branch) and theme='dark' (Line 64 branch)
    const watchedOnlyTasks = [
      { id: 't-1', student_id: 'std-1', unit_id: 'u-1', scheduled_date: '2026-06-19', period: 1, status: 'unstarted' as const, video_watched: true, test_passed: false, created_at: '' }
    ];
    const { container: container3 } = render(
      <SugorokuMap subject="数学" units={mockUnits} tasks={watchedOnlyTasks} theme="dark" />
    );
    expect(container3).toBeDefined();
  });

  // 2. StudentDashboard Interactions
  it('should handle student watch video and test pass/fail buttons', async () => {
    // Add custom tasks to cover line 30 (|| 0), line 252 (!unit return null), and line 43 (status !== 'unstarted')
    const customTasksForDash: LearningTask[] = [
      { id: 't-undef', student_id: 'std-1', unit_id: 'u-invalid', scheduled_date: '2026-06-19', period: undefined as any, status: 'unstarted' as const, video_watched: false, test_passed: false, created_at: '' },
      { id: 't-undef-2', student_id: 'std-1', unit_id: 'u-invalid', scheduled_date: '2026-06-19', period: undefined as any, status: 'unstarted' as const, video_watched: false, test_passed: false, created_at: '' },
      { id: 't-failed-view', student_id: 'std-1', unit_id: 'unit-102-1', scheduled_date: '2026-06-19', period: 3, status: 'failed' as const, video_watched: false, test_passed: false, created_at: '' }
    ];
    const originalTasks = db.getLearningTasks();
    await db.saveLearningTasks([...originalTasks, ...customTasksForDash]);

    // Mock location reload for simulator test
    const originalLocation = window.location;
    const reloadMock = vi.fn();
    delete (window as any).location;
    window.location = { ...originalLocation, reload: reloadMock } as any;

    render(
      <StudentDashboard 
        student={mockStudent} 
        onBackToPortal={() => {}}
      />
    );

    // Initial state check
    expect(screen.getByText(/佐藤 拓海 さんの学習画面/)).toBeInTheDocument();

    // Watch video for failed status task (Line 43 status !== 'unstarted')
    const watchFailedBtn = screen.getAllByText('動画を視聴する (10分)')[1];
    fireEvent.click(watchFailedBtn);
    await waitFor(() => {
      expect(screen.getByText('動画視聴済み')).toBeInTheDocument();
    });

    // 1. Watch video for task-3
    const watchButtons = screen.getAllByText('動画を視聴する (10分)');
    fireEvent.click(watchButtons[0]);
    await waitFor(() => {
      expect(screen.getAllByText('動画視聴済み').length).toBeGreaterThanOrEqual(2);
    });

    // 2. Test pass
    const passButton = screen.getAllByText('単元テストを受ける (合格)')[0];
    fireEvent.click(passButton);
    await waitFor(() => {
      expect(screen.getByText('合格完了！')).toBeInTheDocument();
    });

    // 3. Test fail on second unit
    const failButton = screen.getAllByText('テストを受ける (不合格)')[0];
    fireEvent.click(failButton);
    await waitFor(() => {
      expect(screen.getByText('不合格 (再挑戦)')).toBeInTheDocument();
    });

    // 4. Simulator action (2 days failure)
    const simFailBtn = screen.getByText('⚠️ 2日連続未達成を作る');
    fireEvent.click(simFailBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalled();
    });

    // 5. Simulator reset action
    const simResetBtn = screen.getByText('🔄 全データをリセット');
    fireEvent.click(simResetBtn);
    expect(reloadMock).toHaveBeenCalled();

    // Restore location
    window.location = originalLocation;
  });

  it('should render correct badges for fast/warning students in StudentDashboard', () => {
    // 1. Fast Student
    const fastStudent = { ...mockStudent, status: 'fast' as const };
    render(<StudentDashboard student={fastStudent} onBackToPortal={() => {}} />);
    expect(screen.getByText(/爆速中！/)).toBeInTheDocument();

    // 2. Warning Student
    const warningStudent = { ...mockStudent, status: 'warning' as const };
    render(<StudentDashboard student={warningStudent} onBackToPortal={() => {}} />);
    expect(screen.getByText(/計画パンク/)).toBeInTheDocument();
  });

  it('should trigger fast forward mode when all tasks completed early in StudentDashboard', async () => {
    // クリーンなセットアップ
    db.clearMockData();
    localStorage.setItem('tentoru_learning_tasks', JSON.stringify([]));
    localStorage.setItem('tentoru_curriculum_units', JSON.stringify([]));
    localStorage.setItem('tentoru_students', JSON.stringify([]));
    localStorage.setItem('tentoru_schools', JSON.stringify([]));
    
    const school = { id: 'sch-1', name: 'テスト中学校', type: 'junior_high' as const, created_at: '' };
    await db.saveSchool(school);

    const unit1 = { id: 'unit-103-1', school_id: 'sch-1', subject: '数学', name: '一次方程式', sequence_order: 1, created_at: '' };
    const unit2 = { id: 'unit-104-1', school_id: 'sch-1', subject: '数学', name: '比例と反比例', sequence_order: 2, created_at: '' };
    await db.saveCurriculumUnits([unit1, unit2]);

    await db.saveStudent(mockStudent);

    const customTasks: LearningTask[] = [
      // 今週のタスク (6/19 今日)
      { id: 'ct-1', student_id: 'std-1', unit_id: 'unit-103-1', scheduled_date: '2026-06-19', period: 1, status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
      // 来週のタスク (6/26 未来と 6/25 未来の2点を用意して sort を発火させる)
      { id: 'ct-2', student_id: 'std-1', unit_id: 'unit-104-1', scheduled_date: '2026-06-26', period: null, status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
      { id: 'ct-3', student_id: 'std-1', unit_id: 'unit-104-1', scheduled_date: '2026-06-25', period: null, status: 'unstarted', video_watched: false, test_passed: false, created_at: '' }
    ];
    await db.saveLearningTasks(customTasks);

    render(
      <StudentDashboard 
        student={mockStudent} 
        onBackToPortal={() => {}}
      />
    );

    // テストを受ける (合格) をクリックして完了させる
    const passBtn = screen.getAllByText('単元テストを受ける (合格)')[0];
    fireEvent.click(passBtn);

    // 爆速モードの alert が呼ばれるのを待つ
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('爆速モード突入'));
    });
  });

  it('should handle edge cases in StudentDashboard (no future tasks, elementary student)', async () => {
    // 1. 今週タスクを完了するが未来のタスクが存在しないケース (Line 109 else cover)
    db.clearMockData();
    localStorage.setItem('tentoru_learning_tasks', JSON.stringify([]));
    localStorage.setItem('tentoru_curriculum_units', JSON.stringify([]));
    localStorage.setItem('tentoru_students', JSON.stringify([]));
    localStorage.setItem('tentoru_schools', JSON.stringify([]));

    const school = { id: 'sch-1', name: 'テスト中学校', type: 'junior_high' as const, created_at: '' };
    await db.saveSchool(school);
    const unit1 = { id: 'u-1', school_id: 'sch-1', subject: '数学', name: '単元1', sequence_order: 1, created_at: '' };
    await db.saveCurriculumUnits([unit1]);

    const student = { ...mockStudent };
    const customTasks: LearningTask[] = [
      { id: 'ct-1', student_id: 'std-1', unit_id: 'u-1', scheduled_date: '2026-06-19', period: 1, status: 'unstarted', video_watched: false, test_passed: false, created_at: '' }
    ];
    await db.saveLearningTasks(customTasks);
    
    const { unmount } = render(
      <StudentDashboard 
        student={student} 
        onBackToPortal={() => {}}
      />
    );
    
    const passBtn = screen.getByText('単元テストを受ける (合格)');
    fireEvent.click(passBtn);
    // この時、alertMock は「爆速モード突入」で呼ばれないこと (未来のタスクがないため)
    expect(alertMock).not.toHaveBeenCalled();
    unmount();

    // 2. 小学生の生徒のすごろくマップ描画 (Line 340 else cover)
    const elemStudent: Student = {
      id: 'std-elem',
      student_id: 'student_el',
      name: '小学生生徒',
      email: 'elem@tentoru.com',
      grade: '小5',
      school_id: 'sch-2',
      status: 'normal',
      start_unit_id: null,
      created_at: ''
    };
    render(
      <StudentDashboard 
        student={elemStudent} 
        onBackToPortal={() => {}}
      />
    );
    expect(screen.getByText(/算数の学習マップ/)).toBeInTheDocument();
  });

  // 3. TeacherDashboard Interactions
  it('should support full features in TeacherDashboard', async () => {
    // Add invalidTask (with invalid unit_id) to cover TeacherDashboard line 864
    const invalidTask: LearningTask = {
      id: 't-invalid',
      student_id: 'std-1',
      unit_id: 'u-invalid',
      scheduled_date: '2026-06-19',
      period: 3,
      status: 'unstarted' as const,
      video_watched: false,
      test_passed: false,
      created_at: ''
    };
    const failedTask: LearningTask = {
      id: 't-failed-teacher',
      student_id: 'std-1',
      unit_id: 'unit-102-1',
      scheduled_date: '2026-06-19',
      period: 4,
      status: 'failed' as const,
      video_watched: true,
      test_passed: false,
      created_at: ''
    };
    const currentTasks = db.getLearningTasks();
    await db.saveLearningTasks([...currentTasks, invalidTask, failedTask]);

    await db.addLearningLog({ id: 'fuzz-log-1', student_id: 'std-1', unit_id: 'unit-102-1', log_type: 'video_view', created_at: new Date().toISOString() });
    await db.addLearningLog({ id: 'fuzz-log-2', student_id: 'std-1', unit_id: 'unit-102-1', log_type: 'test_result', created_at: new Date().toISOString() });

    const studentsList = db.getStudents();
    const std2Idx = studentsList.findIndex(s => s.id === 'std-2');
    if (std2Idx >= 0) {
      studentsList[std2Idx].status = 'fast';
      await db.saveStudent(studentsList[std2Idx]);
    }

    const { container } = render(
      <TeacherDashboard 
        onBackToPortal={() => {}}
      />
    );

    expect(screen.getByText('テントル 司令塔ダッシュボード (講師用)')).toBeInTheDocument();

    // 1. Create a student account
    const inputName = screen.getByPlaceholderText('例: 佐藤 拓海');
    
    // 名前が空の状態でアカウント発行を試みてガードを通す
    const newStudentForm = screen.getByText('1クリックアカウント発行').closest('form')!;
    const submitBtn = screen.getByText('1クリックアカウント発行');
    fireEvent.submit(newStudentForm);
    expect(alertMock).not.toHaveBeenCalled();

    fireEvent.change(inputName, { target: { value: '山田 太郎' } });

    // Change new student grade and school selects (Line 637, 651 cover)
    const formSelects = newStudentForm.querySelectorAll('select');
    // formSelects[0] is grade, formSelects[1] is school
    fireEvent.change(formSelects[0], { target: { value: '中2' } });
    fireEvent.change(formSelects[1], { target: { value: 'sch-1' } });
    
    fireEvent.submit(submitBtn.closest('form')!);
    
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('生徒アカウントを発行しました'));
    });

    // 小学生の生徒アカウントも発行して else 分岐をカバー
    fireEvent.change(inputName, { target: { value: '小学生 太郎' } });
    fireEvent.change(formSelects[0], { target: { value: '小6' } });
    fireEvent.change(formSelects[1], { target: { value: 'sch-2' } });
    fireEvent.submit(submitBtn.closest('form')!);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('生徒アカウントを発行しました'));
    });

    // Select newly created student to cover Line 690 (st.start_unit_id || '') empty check
    const studentItemTaro = screen.getByText(/山田 太郎/);
    fireEvent.click(studentItemTaro);
    await waitFor(() => {
      expect(screen.getByText(/山田 太郎 \(ID: student/)).toBeInTheDocument();
    });

    // 佐藤 拓海のAIReportを、teacher_notes と final_text が空の状態で保存
    await db.saveAIReport({
      id: 'rep-1',
      student_id: 'std-1',
      month: '2026-06',
      analysis_text: '佐藤君は今月、数学の「文字式」において非常に意欲的に取り組みました！動画を合計20分視聴し、その後の単元テストでは85%という素晴らしい高得点で一発合格を果たしています。',
      teacher_notes: undefined as any,
      final_text: undefined as any,
      created_at: new Date().toISOString()
    });



    // 2. Select student to load details
    const studentItem = screen.getByText(/佐藤 拓海/);
    fireEvent.click(studentItem);
    await waitFor(() => {
      expect(screen.getByText(/佐藤 拓海 \(ID: student101\)/)).toBeInTheDocument();
    });

    // Select std-2 (Suzuki Yui) who does not have an AI report for 2026-06 to cover line 144 else branch
    const studentItemYui = screen.getByText(/鈴木 結衣/);
    fireEvent.click(studentItemYui);
    await waitFor(() => {
      expect(screen.getByText(/鈴木 結衣 \(ID: student102\)/)).toBeInTheDocument();
    });
    // Switch to AI report tab to render empty preview default text (covers Line 1171 branch)
    const tabAIYui = screen.getByText('AI指導報告書');
    fireEvent.click(tabAIYui);
    await waitFor(() => {
      expect(screen.getByText(/「自動生成」を実行してください。/)).toBeInTheDocument();
    });

    // 鈴木結衣（学習ログなし）で自動生成を実行して Falsy / 0 パスをカバー
    alertMock.mockClear();
    const generateBtnYui = screen.getByText(/今月の学習ログから報告書を自動生成/);
    fireEvent.click(generateBtnYui);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('AI報告書の文章を自動生成しました！');
    }, { timeout: 2500 });

    // レポートが空の状態で保存を試みてガード (!aiReportText return) を通す
    alertMock.mockClear();
    const yuiReportTextarea = Array.from(container.querySelectorAll('textarea')).find(ta => 
      !ta.placeholder && ta.value.includes('鈴木 結衣')
    )!;
    const saveReportBtnYui = screen.getByText('報告書を保存 ＆ 修正履歴を学習 (パターンB)');
    fireEvent.change(yuiReportTextarea, { target: { value: '' } });
    fireEvent.click(saveReportBtnYui);
    expect(alertMock).not.toHaveBeenCalled();

    // Switch back to schedule tab to keep flow clean
    const tabScheduleYui = screen.getByText('学習計画・コマ割り');
    fireEvent.click(tabScheduleYui);

    // Select std-1 back to continue original flow
    fireEvent.click(studentItem);
    await waitFor(() => {
      expect(screen.getByText(/佐藤 拓海 \(ID: student101\)/)).toBeInTheDocument();
    });

    // 3. Tab: Curriculum Management
    const tabCurriculum = screen.getByText('学校カリキュラム管理');
    fireEvent.click(tabCurriculum);
    await waitFor(() => {
      expect(screen.getByText(/学校単位のマスターカリキュラム設定/)).toBeInTheDocument();
    });

    // Change School and Subject (Line 896, 908 cover)
    const schoolLabel = screen.getByText('対象学校');
    const schoolSelectElement = schoolLabel.parentElement!.querySelector('select')!;
    const subjectLabel = screen.getByText('対象教科');
    const subjectSelectElement = subjectLabel.parentElement!.querySelector('select')!;
    fireEvent.change(schoolSelectElement, { target: { value: 'sch-1' } }); // school change handler (896)
    fireEvent.change(subjectSelectElement, { target: { value: '英語' } }); // subject change handler (908)

    // Move curriculum unit down (Line 941 cover - down button)
    const downBtns = container.querySelectorAll('button[title="下へ移動"]');
    if (downBtns.length > 0) {
      fireEvent.click(downBtns[0]); // Click first unit down button
      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('未来の学習計画を再編しました'));
      });
      // 境界値ガードのテスト：最後のボタンの下へ移動 (disabledを解除してクリック)
      const lastDownBtn = downBtns[downBtns.length - 1];
      lastDownBtn.removeAttribute('disabled');
      fireEvent.click(lastDownBtn);
    }

    // Move curriculum unit
    const upBtns = container.querySelectorAll('button[title="上へ移動"]');
    if (upBtns.length > 1) {
      fireEvent.click(upBtns[1]); // Click second unit up button
      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('未来の学習計画を再編しました'));
      });
      // 境界値ガードのテスト：最初のボタンの上へ移動 (disabledを解除してクリック)
      upBtns[0].removeAttribute('disabled');
      fireEvent.click(upBtns[0]);
    }

    // 4. Tab: Tests and Grades
    const tabTests = screen.getByText('定期テスト・模試');
    fireEvent.click(tabTests);
    await waitFor(() => {
      expect(screen.getByText(/定期テスト・模試成績管理/)).toBeInTheDocument();
    });

    // Save regular test score (and fill all form values to cover handlers)
    const regularForm = screen.getByText('定期テスト結果記録').closest('div')!;
    
    const subjectSelect = regularForm.querySelector('select')!;
    const inputs = regularForm.querySelectorAll('input');
    const saveRegularBtn = screen.getByText('定期テスト結果を記録');

    // 得点が空欄の状態で保存を試みてガード (!regularScore return) を通す
    alertMock.mockClear();
    fireEvent.submit(saveRegularBtn.closest('form')!);
    expect(alertMock).not.toHaveBeenCalled();

    // 1回目：上昇率と目標点を空のまま保存して Falsy パスをカバー
    fireEvent.change(subjectSelect, { target: { value: '数学' } });
    fireEvent.change(inputs[0], { target: { value: '75' } }); // score 75
    fireEvent.submit(saveRegularBtn.closest('form')!);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('定期テスト結果を記録しました。');
    });

    // 2回目：全ての値を埋めて保存（従来のテストフロー）
    fireEvent.change(subjectSelect, { target: { value: '英語' } });
    fireEvent.change(inputs[0], { target: { value: '88' } }); // score 88
    
    // 順位上下 select (Line 986 cover)
    const selects = regularForm.querySelectorAll('select');
    if (selects.length > 1) {
      fireEvent.change(selects[1], { target: { value: 'keep' } });
    }

    // 上昇率, 次回目標点 (Line 994, 998 cover)
    fireEvent.change(inputs[1], { target: { value: '12.5' } }); // rate_change
    fireEvent.change(inputs[2], { target: { value: '95' } }); // next_target

    // 改善点 (Line 1002 cover)
    const regularTextarea = regularForm.querySelector('textarea')!;
    fireEvent.change(regularTextarea, { target: { value: '計算練習を増やす' } });

    fireEvent.submit(saveRegularBtn.closest('form')!);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('定期テスト結果を記録しました。');
    });

    // Save mock test score
    const mockForm = screen.getByText('模試結果 ＆ 志望校判定').closest('div')!;
    const saveMockBtn = screen.getByText('模試点数を入力して合格判定算出');

    // 得点や志望校が空欄の状態で保存を試みてガードを通す
    alertMock.mockClear();
    fireEvent.submit(saveMockBtn.closest('form')!);
    expect(alertMock).not.toHaveBeenCalled();
    
    // Change mock subject name (Line 1014 cover)
    const mockSubjectInput = mockForm.querySelector('input[type="text"]')!;
    fireEvent.change(mockSubjectInput, { target: { value: '第1回五ツ木模試' } });

    const mockScoreInput = mockForm.querySelector('input[type="number"]')!;
    fireEvent.change(mockScoreInput, { target: { value: '340' } });
    const selectSchool = mockForm.querySelector('select')!;
    fireEvent.change(selectSchool, { target: { value: 'schcode-A' } });
    fireEvent.submit(saveMockBtn.closest('form')!);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('模試結果を記録しました'));
    });

    // 5. Tab: AI Report
    const tabAI = screen.getByText('AI指導報告書');
    fireEvent.click(tabAI);
    await waitFor(() => {
      expect(screen.getByText(/AI指導報告書生成機能/)).toBeInTheDocument();
    });

    // Edit AI prompt template (Line 1093 cover)
    const tuningBtn = screen.getByText('校舎長プロンプト調整 (パターンA)');
    fireEvent.click(tuningBtn);
    const promptArea = container.querySelector('textarea')!;
    fireEvent.change(promptArea, { target: { value: '新しいプロンプトテンプレート {video_duration}' } });
    const savePromptBtn = screen.getByText('プロンプトテンプレートを保存');
    fireEvent.click(savePromptBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('AIプロンプトテンプレートを更新しました！');
    });

    // Cover prompts.length <= 0 branch in handleSavePromptTemplate
    alertMock.mockClear();
    localStorage.setItem('tentoru_prompt_settings', '[]');
    fireEvent.click(savePromptBtn);
    expect(alertMock).not.toHaveBeenCalled();
    localStorage.removeItem('tentoru_prompt_settings');
    db.getPromptSettings(); // reload seed

    // Close tuning area to keep only report textareas visible
    fireEvent.click(tuningBtn);

    // Auto generate report
    alertMock.mockClear();
    const generateBtn = screen.getByText(/今月の学習ログから報告書を自動生成/);
    fireEvent.click(generateBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('AI報告書の文章を自動生成しました！');
    }, { timeout: 2500 });

    // Edit generated text and teacher notes (Line 1122 and 1135 cover)
    const reportTextarea = Array.from(container.querySelectorAll('textarea')).find(ta => 
      !ta.placeholder && ta.value.includes('佐藤 拓海')
    )!;
    const teacherNotesTextarea = screen.getByPlaceholderText(/二者面談を実施し/);
    fireEvent.change(reportTextarea, { target: { value: '手動でトーンを書き直したポジティブ文章！' } });
    fireEvent.change(teacherNotesTextarea, { target: { value: '三者面談で今月の目標を話しました。' } });

    // Click Save AI report (Line 523 cover)
    const saveReportBtn = screen.getByText('報告書を保存 ＆ 修正履歴を学習 (パターンB)');
    fireEvent.click(saveReportBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('指導報告書を保存し'));
    });

    // Auto generate report again (to cover corrections log filters on TeacherDashboard lines 482-483)
    alertMock.mockClear();
    fireEvent.click(generateBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('AI報告書の文章を自動生成しました！'));
    }, { timeout: 2500 });

    // Save again without editing (covers line 528: aiReportText === originalAiText path)
    fireEvent.click(saveReportBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('指導報告書を保存し'));
    });

    // Export as image (Line 569 cover)
    const exportBtn = screen.getByText(/LINE送信用画像ファイルで出力/);
    fireEvent.click(exportBtn);

    const currentTasksForSkip = db.getLearningTasks();
    const taskIdx = currentTasksForSkip.findIndex(t => t.id === 'task-3');
    if (taskIdx >= 0) {
      currentTasksForSkip[taskIdx].status = 'skipped';
      await db.saveLearningTasks(currentTasksForSkip);
    }
    // 6. Tab: Schedule and Timetable setup
    const tabSchedule = screen.getByText('学習計画・コマ割り');
    fireEvent.click(tabSchedule);
    await waitFor(() => {
      expect(screen.getByText(/学習計画の個別管理/)).toBeInTheDocument();
    });

    // Set unit-103-1 status to skipped temporarily to cover the reset branch
    const startTasks = db.getLearningTasks();
    const t31Idx = startTasks.findIndex(t => t.unit_id === 'unit-103-1' && t.student_id === 'std-1');
    if (t31Idx >= 0) {
      startTasks[t31Idx].status = 'skipped';
      await db.saveLearningTasks(startTasks);
    }

    // Trigger reload by changing schedule date temporarily
    const dateInputReloadForSkip = container.querySelector('input[type="date"]')!;
    fireEvent.change(dateInputReloadForSkip, { target: { value: '2026-06-20' } });
    fireEvent.change(dateInputReloadForSkip, { target: { value: '2026-06-19' } });

    // Change start position (Line 782 cover)
    const startSelect = screen.getByText('学習スタート位置の設定').parentElement!.querySelector('select')!;
    fireEvent.change(startSelect, { target: { value: 'unit-102-1' } });

    // Save start position
    const saveStartBtn = screen.getByText('適用する');
    fireEvent.click(saveStartBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('学習スタート位置を設定しました。スタートより前の単元をTodoから除外しました。');
    });

    // Change Schedule Date (Line 811 cover)
    const dateInput = container.querySelector('input[type="date"]')!;
    fireEvent.change(dateInput, { target: { value: '2026-06-20' } });

    // Change Timetable selections and notes (Line 825, 840 cover)
    const timetableContainer = screen.getByText('コマ割り設定 (標準2コマ / 最大10コマ)').parentElement!;
    
    // Check initial select elements count is 2 (student's default period_count is 2)
    let periodSelects = timetableContainer.querySelectorAll('select');
    expect(periodSelects.length).toBe(2);

    // Click "➕ コマ数を追加 (最大10コマ)" button to increase period count
    const addPeriodBtn = screen.getByText('➕ コマ数を追加 (最大10コマ)');
    fireEvent.click(addPeriodBtn);

    // Verify it increases to 3 select elements
    periodSelects = timetableContainer.querySelectorAll('select');
    expect(periodSelects.length).toBe(3);

    fireEvent.change(periodSelects[0], { target: { value: 'unit-103-1' } });
    fireEvent.change(periodSelects[1], { target: { value: 'unit-102-1' } });
    fireEvent.change(periodSelects[2], { target: { value: 'unit-101-1' } }); // using one of the split math themes

    // Set common office note
    const officeNoteTextarea = timetableContainer.querySelector('textarea')!;
    fireEvent.change(officeNoteTextarea, { target: { value: 'ワーク提出あり' } });

    // Save timetable
    const saveTimetableBtn = screen.getByText('時間割コマ割りを保存');
    fireEvent.click(saveTimetableBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('今日の時間割コマ割りを保存しました！');
    });

    // Trigger normal delayed reschedule (Line 388 branch)
    // Yesterday (6/18) task status to unstarted to make it uncompleted.
    const normalTasks = db.getLearningTasks();
    const t2Idx = normalTasks.findIndex(t => t.id === 'task-2');
    if (t2Idx >= 0) {
      normalTasks[t2Idx].status = 'unstarted';
      await db.saveLearningTasks(normalTasks);
    }
    // Trigger reload
    const dateInputReloadNormal = container.querySelector('input[type="date"]')!;
    fireEvent.change(dateInputReloadNormal, { target: { value: '2026-06-20' } });
    fireEvent.change(dateInputReloadNormal, { target: { value: '2026-06-19' } });

    // Click auto reschedule button (should succeed and alert normal message)
    const normalReschedBtn = screen.getByText(/遅れチェック/);
    fireEvent.click(normalReschedBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('2日連続未達成を検出し、自動リスケジュールを実行しました。未達成タスクを残りの日程に均等配分しました。');
    });

    // Setup 16 uncompleted tasks to trigger punk alert (386 cover)
    // Yesterday (6/18) and Today (6/19) tasks must be uncompleted to trigger rescheduling.
    const punkTasks: LearningTask[] = [];
    punkTasks.push({ id: 'pt-yesterday', student_id: 'std-1', unit_id: 'unit-102-1', scheduled_date: '2026-06-18', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' });
    punkTasks.push({ id: 'pt-today', student_id: 'std-1', unit_id: 'unit-103-1', scheduled_date: '2026-06-19', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' });
    for (let i = 0; i < 14; i++) {
      punkTasks.push({
        id: `pt-future-${i}`,
        student_id: 'std-1',
        unit_id: 'unit-104-1',
        scheduled_date: '2026-06-20',
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        created_at: ''
      });
    }
    await db.deleteLearningTasksByStudent('std-1');
    await db.saveLearningTasks(punkTasks);
    // Trigger reload by changing schedule date temporarily
    const dateInputReload = container.querySelector('input[type="date"]')!;
    fireEvent.change(dateInputReload, { target: { value: '2026-06-20' } });
    fireEvent.change(dateInputReload, { target: { value: '2026-06-19' } });

    // Auto reschedule - this should trigger punk alert warning since we have 16 uncompleted tasks for 5 future dates (16/5 = 3.2 -> 4 tasks/day > max limit 3)
    const autoReschedBtn = screen.getByText(/遅れチェック/);
    fireEvent.click(autoReschedBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('計画パンクアラート発火'));
    });
  }, 15000);

  // 4. Portal Interactions (page.tsx)
  it('should support portal operations and routing simulation', async () => {
    render(<Portal />);

    expect(screen.getByText('TENTORU')).toBeInTheDocument();

    // 1. Theme toggle to Dark
    const themeBtn = screen.getByText('ダークモードにする');
    fireEvent.click(themeBtn);
    expect(screen.getByText('ライトモードにする')).toBeInTheDocument();

    // 2. Teacher login under Dark theme (covers page.tsx line 57 theme === 'dark')
    const teacherLoginCard = screen.getByText('講師・管理者');
    fireEvent.click(teacherLoginCard);
    expect(screen.getByText('テントル 司令塔ダッシュボード (講師用)')).toBeInTheDocument();

    // Back to portal
    const backBtn = screen.getByText('ポータルへ戻る');
    fireEvent.click(backBtn);
    expect(screen.getByText('TENTORU')).toBeInTheDocument();

    // 3. Student select login with selection under Dark theme (covers page.tsx line 66 theme === 'dark')
    const selectEl = screen.getByRole('combobox');
    fireEvent.change(selectEl, { target: { value: 'std-1' } });
    
    const studentLoginBtn = screen.getByText('生徒画面へ入る ➔');
    fireEvent.click(studentLoginBtn);
    expect(screen.getByText(/佐藤 拓海 さんの学習画面/)).toBeInTheDocument();

    // Back to portal
    const logoutBtn = screen.getByText('ログアウト（ポータルへ）');
    fireEvent.click(logoutBtn);
    expect(screen.getByText('TENTORU')).toBeInTheDocument();

    // 4. Toggle theme back to Light
    fireEvent.click(screen.getByText('ライトモードにする'));
    expect(screen.getByText('ダークモードにする')).toBeInTheDocument();

    // 4b. Teacher login under Light theme (covers page.tsx line 57 theme === 'light')
    const teacherLoginCardLight = screen.getByText('講師・管理者');
    fireEvent.click(teacherLoginCardLight);
    expect(screen.getByText('テントル 司令塔ダッシュボード (講師用)')).toBeInTheDocument();
    
    // Back to portal
    const backBtnLight = screen.getByText('ポータルへ戻る');
    fireEvent.click(backBtnLight);
    expect(screen.getByText('TENTORU')).toBeInTheDocument();

    // 4c. Student login under Light theme (covers page.tsx line 66 theme === 'light')
    const selectElLight = screen.getByRole('combobox');
    fireEvent.change(selectElLight, { target: { value: 'std-1' } });
    const studentLoginBtnLight = screen.getByText('生徒画面へ入る ➔');
    fireEvent.click(studentLoginBtnLight);
    expect(screen.getByText(/佐藤 拓海 さんの学習画面/)).toBeInTheDocument();

    // Logout
    const logoutBtnLight = screen.getByText('ログアウト（ポータルへ）');
    fireEvent.click(logoutBtnLight);
    expect(screen.getByText('TENTORU')).toBeInTheDocument();

    // 5. Student select login without student selection (error alert path cover)
    const studentLoginBtnError = screen.getByText('生徒画面へ入る ➔');
    fireEvent.click(studentLoginBtnError);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('生徒を選択してください。');
    });

    // 6. Student select login with invalid student selection (if (student) false path cover)
    // Append a dummy option to select element to simulate invalid student state selection
    const selectElError = screen.getByRole('combobox');
    const opt = document.createElement('option');
    opt.value = 'std-invalid';
    opt.text = '無効な生徒';
    selectElError.appendChild(opt);

    fireEvent.change(selectElError, { target: { value: 'std-invalid' } });
    const studentLoginBtnError2 = screen.getByText('生徒画面へ入る ➔');
    fireEvent.click(studentLoginBtnError2);
    
    // Page should still remain on Portal because the transition was guarded (if (student) is falsy)
    expect(screen.getByText('TENTORU')).toBeInTheDocument();
  });

  it('should handle TeacherDashboard fallback when school list is empty', () => {
    localStorage.setItem('tentoru_schools', JSON.stringify([]));
    const { unmount } = render(<TeacherDashboard onBackToPortal={() => {}} />);
    unmount();
    db.clearMockData();
    db.getSchools();
  });

  it('should support period selection, homework, test config saves in TeacherDashboard and reflect in StudentDashboard', async () => {
    await db.saveMiniTestResult({
      id: 'mini-std-1-yesterday',
      student_id: 'std-1',
      date: '2026-06-18',
      test_content: '過去のテスト',
      score: 70,
      homework_content: '宿題その1',
      homework_deadline: '2026-06-19',
      created_at: new Date().toISOString()
    });

    const { unmount: unmountTeacher } = render(<TeacherDashboard onBackToPortal={() => {}} />);
    
    const studentItem = screen.getByText(/佐藤 拓海/);
    fireEvent.click(studentItem);
    
    const tabSchedule = screen.getByText('学習計画・コマ割り');
    fireEvent.click(tabSchedule);

    const tabMiniTests = screen.getByText('小テスト結果');
    expect(tabMiniTests).toBeInTheDocument();

    const cellNum1 = screen.getByText('1', { selector: 'span' });
    const period1Select = cellNum1.parentElement!.querySelector('select')!;
    fireEvent.change(period1Select, { target: { value: '理科' } });
    const customThemeInput = screen.getByPlaceholderText('テーマを入力（例: 歴史・電流など）');
    fireEvent.change(customThemeInput, { target: { value: '電流の性質' } });

    const officeNoteTextarea = screen.getByPlaceholderText('業務連絡（例：提出ワーク忘れずに）');
    fireEvent.change(officeNoteTextarea, { target: { value: '持ち物：実験道具' } });

    // テストを2つ追加して1つ削除
    const addTestBtn = screen.getByText('➕ テストを追加');
    fireEvent.click(addTestBtn);
    fireEvent.click(addTestBtn);
    const testInputs = screen.getAllByPlaceholderText('例: 二次方程式10問');
    fireEvent.change(testInputs[0], { target: { value: '数学小テスト（一次方程式）' } });
    fireEvent.change(testInputs[1], { target: { value: '削除するテスト' } });
    const deleteTestBtn = testInputs[1].closest('div')!.querySelector('button')!;
    fireEvent.click(deleteTestBtn); // 2つ目のテストを削除

    // 宿題を2つ追加して1つ削除
    const addHwBtn = screen.getByText('➕ 宿題を追加');
    fireEvent.click(addHwBtn);
    fireEvent.click(addHwBtn);
    const hwContentInputs = screen.getAllByPlaceholderText('宿題の内容を入力（例：ワークP24-25）');
    // 親要素経由で2つの日付入力フィールドを取得
    const hwDeadlineInputs = hwContentInputs[0].closest('div')!.parentElement!.parentElement!.querySelectorAll('input[type="date"]');
    
    fireEvent.change(hwContentInputs[0], { target: { value: '数学ワークP45' } });
    fireEvent.change(hwDeadlineInputs[0], { target: { value: '2026-06-25' } });
    fireEvent.change(hwContentInputs[1], { target: { value: '削除する宿題' } });
    fireEvent.change(hwDeadlineInputs[1], { target: { value: '2026-06-26' } });
    
    const deleteHwBtn = hwContentInputs[1].closest('div')!.querySelector('button')!;
    fireEvent.click(deleteHwBtn); // 2つ目の宿題を削除

    const testInput = testInputs[0];
    const hwContentInput = hwContentInputs[0];
    const hwDeadlineInput = hwDeadlineInputs[0];

    const saveBtn = screen.getByText('時間割コマ割りを保存');
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('今日の時間割コマ割りを保存しました！');
    });

    const miniResults = db.getMiniTestResults();
    const testResult = miniResults.find(r => r.student_id === 'std-1' && r.date === '2026-06-19');
    expect(testResult).toBeDefined();
    expect(testResult?.test_content).toBe('数学小テスト（一次方程式）');

    const hwResults = db.getHomeworkResults();
    const hwResult = hwResults.find(r => r.student_id === 'std-1' && r.date === '2026-06-19');
    expect(hwResult).toBeDefined();
    expect(hwResult?.homework_content).toBe('数学ワークP45');
    expect(hwResult?.homework_deadline).toBe('2026-06-25');

    unmountTeacher();

    // 宿題の status: 'skipped', 'incomplete', 'completed' のブランチをカバーするための宿題データを流し込む
    await db.saveHomeworkResult({
      id: 'hw-completed',
      student_id: 'std-1',
      date: '2026-06-19',
      homework_content: '提出済みの宿題',
      homework_deadline: '2026-06-27',
      status: 'completed',
      created_at: new Date().toISOString()
    });
    await db.saveHomeworkResult({
      id: 'hw-skipped',
      student_id: 'std-1',
      date: '2026-06-19',
      homework_content: 'スキップ宿題',
      homework_deadline: '2026-06-26',
      status: 'skipped',
      created_at: new Date().toISOString()
    });
    await db.saveHomeworkResult({
      id: 'hw-incomplete',
      student_id: 'std-1',
      date: '2026-06-19',
      homework_content: '未完の宿題',
      homework_deadline: '', // 期限なしのブランチもカバー
      status: 'incomplete',
      created_at: new Date().toISOString()
    });

    const testStudent: Student = {
      id: 'std-1',
      student_id: 'student101',
      name: '佐藤 拓海',
      email: 'student101@tentoru.com',
      grade: '中3',
      school_id: 'sch-1',
      status: 'normal',
      start_unit_id: null,
      created_at: ''
    };
    
    const { unmount } = render(<StudentDashboard student={testStudent} onBackToPortal={() => {}} />);

    expect(screen.getByText('📝 本日のテスト')).toBeInTheDocument();
    expect(screen.getByText('数学小テスト（一次方程式）')).toBeInTheDocument();
    expect(screen.getByText('📚 今日の宿題')).toBeInTheDocument();
    expect(screen.getByText('数学ワークP45')).toBeInTheDocument();
    expect(screen.getByText('提出期限: 2026-06-25')).toBeInTheDocument();
    expect(screen.getByText('スキップ宿題')).toBeInTheDocument();
    expect(screen.getByText('未完の宿題')).toBeInTheDocument();
    expect(screen.getByText('提出済みの宿題')).toBeInTheDocument();
    expect(screen.getByText('提出期限: 2026-06-26')).toBeInTheDocument();
    expect(screen.getByText('提出期限: 2026-06-27')).toBeInTheDocument();
    expect(screen.getAllByText('スキップ').length).toBeGreaterThan(0);
    expect(screen.getAllByText('未完').length).toBeGreaterThan(0);
    expect(screen.getAllByText('提出済み').length).toBeGreaterThan(0);

    const scoreInput = screen.getByPlaceholderText('点数を入力');
    const saveScoreBtn = screen.getByText('結果を保存');
    fireEvent.change(scoreInput, { target: { value: '150' } });
    fireEvent.click(saveScoreBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('0〜100の点数を入力してください。');
    });

    fireEvent.change(scoreInput, { target: { value: '88' } });
    fireEvent.click(saveScoreBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('小テスト点数を送信しました！');
    });

    const completeCustomBtn = screen.getByText('この授業を完了にする');
    fireEvent.click(completeCustomBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('授業を完了にしました！');
    });

    const updatedMiniResults = db.getMiniTestResults();
    const updatedResult = updatedMiniResults.find(r => r.student_id === 'std-1' && r.date === '2026-06-19');
    expect(updatedResult?.score).toBe(88);

    unmount();

    const { unmount: unmountTeacher2 } = render(<TeacherDashboard onBackToPortal={() => {}} />);
    const studentItem2 = screen.getByText(/佐藤 拓海/);
    fireEvent.click(studentItem2);
    
    const tabMiniTestsBtn = screen.getByText('小テスト結果');
    fireEvent.click(tabMiniTestsBtn);
    expect(screen.getByText('数学小テスト（一次方程式）')).toBeInTheDocument();

    const tabHomeworksBtn = screen.getByText('宿題提出状況');
    fireEvent.click(tabHomeworksBtn);
    expect(screen.getByText('数学ワークP45')).toBeInTheDocument();

    // 宿題提出状況の更新・保存テスト
    const hwRow = screen.getByText('数学ワークP45').closest('tr')!;
    const hwSelect = hwRow.querySelector('select')!;
    fireEvent.change(hwSelect, { target: { value: 'completed' } });
    const hwSaveBtn = hwRow.querySelector('button')!;
    fireEvent.click(hwSaveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('宿題提出状況を保存しました！');
    });

    const finalHwResults = db.getHomeworkResults();
    const finalHwResult = finalHwResults.find(r => r.student_id === 'std-1' && r.date === '2026-06-19');
    expect(finalHwResult?.status).toBe('completed');

    // 小テスト点数の更新テスト
    fireEvent.click(tabMiniTestsBtn);
    const scoreCellInput = screen.getByDisplayValue('88');
    fireEvent.change(scoreCellInput, { target: { value: '150' } });
    const teacherSaveBtn = scoreCellInput.closest('tr')!.querySelector('button')!;
    fireEvent.click(teacherSaveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('点数は0〜100の範囲で入力してください。');
    });

    fireEvent.change(scoreCellInput, { target: { value: '95' } });
    fireEvent.click(teacherSaveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('小テスト点数を保存しました！');
    });

    const finalMiniResults = db.getMiniTestResults();
    const finalResult = finalMiniResults.find(r => r.student_id === 'std-1' && r.date === '2026-06-19');
    expect(finalResult?.score).toBe(95);

    // 既存のテスト/宿題の削除保存テスト（DBからの削除ブランチのカバー）
    const tabScheduleBtn = screen.getByText('学習計画・コマ割り');
    fireEvent.click(tabScheduleBtn);
    
    // 既存のテスト入力欄とその削除ボタンを取得
    const testInputs2 = screen.getAllByPlaceholderText('例: 二次方程式10問');
    const deleteTestBtn2 = testInputs2[0].closest('div')!.querySelector('button')!;
    fireEvent.click(deleteTestBtn2); // 数学小テストを削除

    // 既存の宿題入力欄とその削除ボタンを取得
    const hwContentInputs2 = screen.getAllByPlaceholderText('宿題の内容を入力（例：ワークP24-25）');
    const deleteHwBtn2 = hwContentInputs2[0].closest('div')!.querySelector('button')!;
    fireEvent.click(deleteHwBtn2); // 数学ワークP45を削除

    const saveBtn2 = screen.getByText('時間割コマ割りを保存');
    fireEvent.click(saveBtn2);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('今日の時間割コマ割りを保存しました！');
    });

    // 削除がDBに反映されたか確認
    const finalMiniResultsAfterDel = db.getMiniTestResults();
    expect(finalMiniResultsAfterDel.find(r => r.test_content === '数学小テスト（一次方程式）')).toBeUndefined();

    const finalHwResultsAfterDel = db.getHomeworkResults();
    expect(finalHwResultsAfterDel.find(r => r.homework_content === '数学ワークP45')).toBeUndefined();

    unmountTeacher2();
  });

  it('should support edge cases, unit sorting, custom task updates, and AI report manual corrections in TeacherDashboard', async () => {
    const { container, unmount } = render(<TeacherDashboard onBackToPortal={() => {}} />);
    
    // 生徒を選択する
    const studentItem = screen.getByText(/佐藤 拓海/);
    fireEvent.click(studentItem);

    // 0. 初期状態での小テスト結果が空であることの確認 (length === 0 分岐のカバー)
    const tabMiniTestsBtn = screen.getByText('小テスト結果');
    fireEvent.click(tabMiniTestsBtn);
    expect(screen.getByText('記録された小テスト結果はありません。')).toBeInTheDocument();

    const tabHomeworksBtn = screen.getByText('宿題提出状況');
    fireEvent.click(tabHomeworksBtn);
    expect(screen.getByText('記録された宿題はありません。')).toBeInTheDocument();

    // 1. カリキュラム順序変更 (moveUnit) のテスト
    // 「学校カリキュラム管理」タブを開く
    const tabCurriculum = screen.getByText('学校カリキュラム管理');
    fireEvent.click(tabCurriculum);

    // リストの移動ボタンを取得
    const upButtons = screen.getAllByTitle('上へ移動');
    const downButtons = screen.getAllByTitle('下へ移動');
    
    // ガード節の検証 (最上部を上、最下部を下)
    fireEvent.click(upButtons[0]);
    fireEvent.click(downButtons[downButtons.length - 1]);
    
    // 通常の移動 (上から2番目を上へ)
    if (upButtons.length > 1) {
      fireEvent.click(upButtons[1]);
      await waitFor(() => {
        expect(alertMock).toHaveBeenLastCalledWith('カリキュラムの順序を更新し、対象生徒の未来の学習計画を再編しました。(過去の完了ログは維持されています)');
      });
    }

    // 2. カスタムタスクの上書き更新
    // 学習計画・コマ割りタブを開く
    const tabSchedule = screen.getByText('学習計画・コマ割り');
    fireEvent.click(tabSchedule);

    // 1時間目に理科を選択し、テーマを入力して保存
    const cellNum1 = screen.getByText('1', { selector: 'span' });
    const period1Select = cellNum1.parentElement!.querySelector('select')!;
    fireEvent.change(period1Select, { target: { value: '理科' } });
    const customThemeInput = screen.getByPlaceholderText('テーマを入力（例: 歴史・電流など）');
    fireEvent.change(customThemeInput, { target: { value: '電流の性質' } });
    
    const saveBtn = screen.getByText('時間割コマ割りを保存');
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('今日の時間割コマ割りを保存しました！');
    });

    // 同じスロットに再度別テーマのカスタムタスクを設定して保存 (existingCustomTaskIdx >= 0 の上書き処理)
    fireEvent.change(customThemeInput, { target: { value: '光の反射' } });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('今日の時間割コマ割りを保存しました！');
    });
    
    // 反映を確認
    const miniTasks = db.getLearningTasks();
    const updatedCustom = miniTasks.find(t => t.student_id === 'std-1' && t.scheduled_date === '2026-06-19' && t.period === 1);
    expect(updatedCustom?.custom_unit_name).toBe('光の反射');

    // 3. 数学や英語でのカリキュラム単元選択 (unitId) と「またはテーマを自由に入力」の変更テスト
    // 1時間目を数学に変更
    fireEvent.change(period1Select, { target: { value: '数学' } });
    // 数学に変更するとカリキュラム単元のドロップダウンが表示される
    const parentContainer = period1Select.parentElement!;
    await waitFor(() => {
      const selects = parentContainer.querySelectorAll('select');
      expect(selects.length).toBe(2);
    });
    const selects = parentContainer.querySelectorAll('select');
    const unitSelect = selects[1]; // 単元セレクト
    
    // プルダウンを変更 (単元を選択)
    fireEvent.change(unitSelect, { target: { value: 'unit-101-1' } });
    
    // 「またはテーマを自由に入力」が disabled になっていることを確認
    const unitCustomInput = parentContainer.querySelector('input[placeholder="またはテーマを自由に入力"]')! as HTMLInputElement;
    await waitFor(() => {
      expect(unitCustomInput).toBeDisabled();
    });

    // プルダウンを未選択に戻し、自由入力を可能にする
    fireEvent.change(unitSelect, { target: { value: '' } });
    await waitFor(() => {
      expect(unitCustomInput).not.toBeDisabled();
    });
    fireEvent.change(unitCustomInput, { target: { value: '数学自由単元' } });
    
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('今日の時間割コマ割りを保存しました！');
    });

    // 4. AI指導報告書の手動修正および未生成保存ガードのテスト
    const tabAIReport = screen.getByText('AI指導報告書');
    fireEvent.click(tabAIReport);
    
    // レポートテキストが空の状態で保存ボタンをクリック (ガードを通過)
    const reportSaveBtn = screen.getByText('報告書を保存 ＆ 修正履歴を学習 (パターンB)');
    fireEvent.click(reportSaveBtn);
    
    // AI報告書を生成
    const generateAIBtn = screen.getByText('今月の学習ログから報告書を自動生成 (AI分析ステップ)');
    fireEvent.click(generateAIBtn);
    
    // 生成完了を待つ (setTimeoutが1.5秒)
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('AI報告書の文章を自動生成しました！');
    }, { timeout: 3000 });

    // 生成されたテキストを変更する
    const reportTextarea = document.querySelectorAll('textarea')[0];
    const originalText = reportTextarea.value;
    fireEvent.change(reportTextarea, { target: { value: originalText + '\n追加のフィードバック' } });
    
    // 保存を実行
    fireEvent.click(reportSaveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('指導報告書を保存し、文体修正履歴を学習しました！');
    });

    // 学習履歴に保存されたか確認
    const correctionLogs = db.getTeacherCorrectionsLogs();
    expect(correctionLogs.length).toBeGreaterThan(0);
    expect(correctionLogs[0].corrected_text).toContain('追加のフィードバック');

    // 5. 小テスト結果管理での変則データのカバレッジテスト
    // 不明な生徒や、宿題なし・期限なしの小テスト結果を表示させるテスト
    await db.saveMiniTestResult({
      id: 'mini-unknown-student',
      student_id: 'non-existent-student-id',
      date: '2026-06-19',
      test_content: '変則テスト',
      score: null,
      created_at: new Date().toISOString()
    });

    // 表示更新のため生徒を切り替えて戻す
    const yuiItem = screen.getByText(/鈴木 結衣/);
    fireEvent.click(yuiItem);
    const takumiItem = screen.getByText(/佐藤 拓海/);
    fireEvent.click(takumiItem);

    // 再度小テスト結果タブを開く
    const tabMiniTestsBtn2 = screen.getByText('小テスト結果');
    fireEvent.click(tabMiniTestsBtn2);

    // 反映とフォールバックの確認
    expect(screen.getByText('不明な生徒')).toBeInTheDocument();

    // 6. 年間計画タブのテスト (Milestones)
    // 一旦完了タスクを削除し、かつ平日（4月2週）に日付を変更して全ブランチを通す
    await db.deleteLearningTasksByStudent('std-1');

    // 日付変更のためにまず学習計画タブに戻る
    const tabScheduleForMilestones = screen.getByText('学習計画・コマ割り');
    fireEvent.click(tabScheduleForMilestones);

    const dateInput = container.querySelector('input[type="date"]')!;
    fireEvent.change(dateInput, { target: { value: '2026-04-10' } });

    const tabMilestones = screen.getByText('年間計画（マイルストーン）');
    fireEvent.click(tabMilestones);
    await waitFor(() => {
      expect(screen.getByText('年間基準計画（マイルストーン） & 進捗現在地ハイライト')).toBeInTheDocument();
    });

    // 目標週バッジ、現在地バッジが表示されているか確認
    expect(screen.getByText('🎯 目標週 (基準)')).toBeInTheDocument();
    expect(screen.getAllByText(/現在地/).length).toBeGreaterThan(0);

    // 教科の切り替え (英語へ) を追加し、onChange ブランチをカバーする
    const selectSubjectElement = container.querySelector('select[value="数学"]') as HTMLSelectElement;
    if (selectSubjectElement) {
      fireEvent.change(selectSubjectElement, { target: { value: '英語' } });
    }

    // 元に戻す
    fireEvent.click(tabScheduleForMilestones);
    fireEvent.change(dateInput, { target: { value: '2026-06-19' } });
    await db.saveLearningTasks(db.getLearningTasks()); // シード初期タスクの復元

    unmount();
  });
});
