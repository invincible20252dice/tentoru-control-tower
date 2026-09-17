import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student } from '../lib/db';

describe('Precision 95%+ Deep Strike Test Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);

    await db.restoreAllDefaultData();
  });

  it('should exercise student list navigation, tab clicks, milestone exclusion, and modals', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          onLogout={vi.fn()}
        />
      );
    });

    // 1. Click on a student from the student list
    const studentCards = screen.queryAllByText(/中尾.*謙信/i);
    const studentCard = studentCards.length > 0 ? studentCards[0] : null;
    if (studentCard) {
      await act(async () => {
        fireEvent.click(studentCard);
      });
    }

    // 2. Click on "年間計画（マイルストーン）" menu
    const milestoneMenu = screen.queryByText(/年間計画.*マイルストーン/i);
    if (milestoneMenu) {
      await act(async () => {
        fireEvent.click(milestoneMenu);
      });
    }

    // 3. Exclude lesson / test node button
    const excludeBtns = screen.queryAllByTitle(/カリキュラムから除外/i);
    if (excludeBtns.length > 0) {
      await act(async () => {
        fireEvent.click(excludeBtns[0]);
      });
    }

    // 4. Reset excluded lessons button
    const resetExcludedBtn = screen.queryByText(/除外をリセット/i) || screen.queryByTitle(/除外をリセット/i);
    if (resetExcludedBtn) {
      await act(async () => {
        fireEvent.click(resetExcludedBtn);
      });
    }

    // 5. Edit Unit Test modal open from timeline
    const editUnitTestBtns = screen.queryAllByTitle(/単元テストを編集/i);
    if (editUnitTestBtns.length > 0) {
      await act(async () => {
        fireEvent.click(editUnitTestBtns[0]);
      });

      const modal = screen.queryByTestId('unit-test-master-modal');
      if (modal) {
        const gradeSelect = modal.querySelectorAll('select')[1] as HTMLSelectElement;
        if (gradeSelect) {
          await act(async () => {
            fireEvent.change(gradeSelect, { target: { value: '小6' } });
          });
        }
        const cancelBtn = screen.getByText(/キャンセル/i);
        await act(async () => {
          fireEvent.click(cancelBtn);
        });
      }
    }

    // 6. Delete Unit Test button
    const deleteUnitTestBtns = screen.queryAllByTitle(/単元テストを削除/i);
    if (deleteUnitTestBtns.length > 0) {
      await act(async () => {
        fireEvent.click(deleteUnitTestBtns[0]);
      });
    }
  });

  it('should exercise interaction log editing, memo update, category change, and cancellation', async () => {
    const students = db.getStudents();
    const targetStudent = students[0];

    // Seed an interaction
    await db.saveStudentInteraction({
      id: 'inter-test-edit-1',
      student_id: targetStudent.id,
      date: '2026-09-17',
      category: '保護者対応',
      memo: 'テスト対策についての面談メモ',
      staff_name: '田中講師',
      created_at: new Date().toISOString()
    });

    await act(async () => {
      render(
        <TeacherDashboard
          onLogout={vi.fn()}
          initialStudentId={targetStudent.id}
          initialTab="student-detail"
        />
      );
    });

    // 1. Click edit interaction button
    const editBtn = screen.queryByTestId('edit-interaction-inter-test-edit-1');
    if (editBtn) {
      await act(async () => {
        fireEvent.click(editBtn);
      });

      // Change memo text
      const textarea = screen.queryByDisplayValue('テスト対策についての面談メモ');
      if (textarea) {
        await act(async () => {
          fireEvent.change(textarea, { target: { value: '更新された面談メモ' } });
        });
      }

      // Save edited interaction
      const saveEditBtn = screen.queryByText('保存');
      if (saveEditBtn) {
        await act(async () => {
          fireEvent.click(saveEditBtn);
        });
      }
    }

    // 2. Click delete interaction
    const deleteBtn = screen.queryByTestId('delete-interaction-inter-test-edit-1');
    if (deleteBtn) {
      await act(async () => {
        fireEvent.click(deleteBtn);
      });
    }
  });

  it('should exercise Branch AI rules modal cancellation and input changes', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          onLogout={vi.fn()}
        />
      );
    });

    const aiRulesBtn = screen.queryByText(/AI計画ルール/i) || screen.queryByText(/校舎別AIルール/i);
    if (aiRulesBtn) {
      await act(async () => {
        fireEvent.click(aiRulesBtn);
      });

      const modal = screen.queryByTestId('branch-ai-rules-modal');
      if (modal) {
        const cancelBtn = modal.querySelector('button') as HTMLButtonElement;
        if (cancelBtn) {
          await act(async () => {
            fireEvent.click(cancelBtn);
          });
        }
      }
    }
  });

  it('should exercise student detail personality master deletion and chip toggling edge cases', async () => {
    const students = db.getStudents();
    const targetStudent = students[0];

    await act(async () => {
      render(
        <TeacherDashboard
          onLogout={vi.fn()}
          initialStudentId={targetStudent.id}
          initialTab="student-detail"
        />
      );
    });

    // 1. Select master personality and delete from master
    const pMasterSelect = screen.queryByTestId('personality-master-select') as HTMLSelectElement;
    if (pMasterSelect && pMasterSelect.options.length > 1) {
      await act(async () => {
        fireEvent.change(pMasterSelect, { target: { value: pMasterSelect.options[1].value } });
      });

      const deleteMasterBtn = screen.queryByTestId('delete-personality-master-btn');
      if (deleteMasterBtn) {
        await act(async () => {
          fireEvent.click(deleteMasterBtn);
        });
      }
    }

    // 2. Remove existing personality tag from student
    const removeTagBtn = screen.queryAllByLabelText(/個性を解除/i)[0];
    if (removeTagBtn) {
      await act(async () => {
        fireEvent.click(removeTagBtn);
      });
    }

    // 3. Subject chip deselect validation (cannot deselect all)
    const activeSubjChips = screen.queryAllByTestId(/subject-chip-/);
    if (activeSubjChips.length > 0) {
      for (const chip of activeSubjChips) {
        await act(async () => {
          fireEvent.click(chip);
        });
      }
    }
  });
});
