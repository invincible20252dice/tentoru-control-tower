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
    const watchFailedBtn = screen.getAllByText('動画を視聴する (10分)')[2];
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
});
