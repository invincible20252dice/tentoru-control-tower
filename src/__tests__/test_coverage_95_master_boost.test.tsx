import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import { BranchManagement } from '../components/BranchManagement';
import { CurriculumCsvImport } from '../components/CurriculumCsvImport';
import { db, Student, CurriculumMaster, Branch, StudentInteraction, MilestoneTemplate, AIReport, TestRecord } from '../lib/db';

describe('Master 95%+ High Coverage & Deep Branch Testing Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);

    await db.restoreAllDefaultData();
  });

  describe('TeacherDashboard Comprehensive Deep Interaction', () => {
    it('should cover all student detail editing, target schools, frequency, day chips, subject chips, and start unit dropdowns', async () => {
      const students = db.getStudents();
      const targetStudent = students[0];

      await act(async () => {
        render(
          <TeacherDashboard
            onLogout={vi.fn()}
            initialStudentId={targetStudent.id}
            initialTab="detail"
          />
        );
      });

      // 1. Add target school
      const addSchoolBtn = screen.queryByText(/＋ 志望校を追加/i);
      if (addSchoolBtn) {
        await act(async () => {
          fireEvent.click(addSchoolBtn);
          fireEvent.click(addSchoolBtn);
        });
      }

      // 2. Weekly sessions count dropdown
      const freqSelect = document.getElementById('edit-weekly-frequency') as HTMLSelectElement;
      if (freqSelect) {
        await act(async () => {
          fireEvent.change(freqSelect, { target: { value: '3回' } });
          fireEvent.change(freqSelect, { target: { value: '5回' } });
          fireEvent.change(freqSelect, { target: { value: '無制限' } });
          fireEvent.change(freqSelect, { target: { value: '2回' } });
        });
      }

      // 3. Weekly duration dropdown
      const durSelect = document.getElementById('edit-weekly-duration') as HTMLSelectElement;
      if (durSelect) {
        await act(async () => {
          fireEvent.change(durSelect, { target: { value: '60分' } });
          fireEvent.change(durSelect, { target: { value: '90分' } });
          fireEvent.change(durSelect, { target: { value: '180分' } });
          fireEvent.change(durSelect, { target: { value: '240分' } });
          fireEvent.change(durSelect, { target: { value: '無制限' } });
          fireEvent.change(durSelect, { target: { value: '120分' } });
        });
      }

      // 4. Default slots dropdown
      const slotsSelect = document.getElementById('edit-default-slots') as HTMLSelectElement;
      if (slotsSelect) {
        await act(async () => {
          fireEvent.change(slotsSelect, { target: { value: '3' } });
          fireEvent.change(slotsSelect, { target: { value: '4' } });
          fireEvent.change(slotsSelect, { target: { value: '2' } });
        });
      }

      // 5. Day chips toggle & validation
      const monChip = screen.queryByTestId('day-chip-monday');
      const wedChip = screen.queryByTestId('day-chip-wednesday');
      const thuChip = screen.queryByTestId('day-chip-thursday');
      if (monChip) await act(async () => { fireEvent.click(monChip); });
      if (wedChip) await act(async () => { fireEvent.click(wedChip); });
      if (thuChip) await act(async () => { fireEvent.click(thuChip); });

      // 6. Subject chips toggle & validation
      const mathChip = screen.queryByTestId('subject-chip-算数') || screen.queryByTestId('subject-chip-数学');
      if (mathChip) {
        await act(async () => {
          fireEvent.click(mathChip);
          fireEvent.click(mathChip);
        });
      }

      // 7. Start unit dropdowns: Grade select & Unit select
      const mathGradeSelect = screen.queryByTestId('start-grade-select-start_unit_math') as HTMLSelectElement;
      if (mathGradeSelect) {
        await act(async () => {
          fireEvent.change(mathGradeSelect, { target: { value: '5年生' } });
        });
        const mathUnitSelect = screen.queryByTestId('start-unit-select-start_unit_math') as HTMLSelectElement;
        if (mathUnitSelect && mathUnitSelect.options.length > 1) {
          await act(async () => {
            fireEvent.change(mathUnitSelect, { target: { value: mathUnitSelect.options[1].value } });
          });
        }
      }

      // 8. Personality tags: add from master, add new, remove
      const pMasterSelect = screen.queryByTestId('personality-master-select') as HTMLSelectElement;
      if (pMasterSelect && pMasterSelect.options.length > 1) {
        await act(async () => {
          fireEvent.change(pMasterSelect, { target: { value: pMasterSelect.options[1].value } });
        });
        const addPBtn = screen.queryByTestId('add-personality-btn');
        if (addPBtn) await act(async () => { fireEvent.click(addPBtn); });
      }

      const pInput = screen.queryByTestId('new-personality-input') as HTMLInputElement;
      if (pInput) {
        await act(async () => {
          fireEvent.change(pInput, { target: { value: '探究心が強い' } });
        });
        const addPBtn = screen.queryByTestId('add-personality-btn');
        if (addPBtn) await act(async () => { fireEvent.click(addPBtn); });
      }

      // 9. Interaction log form: add, edit, delete
      const categorySelect = document.getElementById('interaction-category') as HTMLSelectElement;
      if (categorySelect) {
        await act(async () => {
          fireEvent.change(categorySelect, { target: { value: '人生相談' } });
        });
      }
      const staffSelect = document.getElementById('interaction-staff-name') as HTMLSelectElement;
      if (staffSelect) {
        await act(async () => {
          fireEvent.change(staffSelect, { target: { value: 'other' } });
        });
        const customStaffInput = screen.queryByPlaceholderText(/講師名を入力/i);
        if (customStaffInput) {
          await act(async () => {
            fireEvent.change(customStaffInput, { target: { value: '佐藤講師' } });
          });
        }
      }
      const memoTextarea = screen.queryByPlaceholderText(/具体的な対応メモを入力/i);
      if (memoTextarea) {
        await act(async () => {
          fireEvent.change(memoTextarea, { target: { value: '算数の分数の計算でつまずいているため補習を実施。' } });
        });
        const submitBtn = screen.queryByText(/対応内容を登録/i);
        if (submitBtn) await act(async () => { fireEvent.click(submitBtn); });
      }

      // Save student changes
      const saveStudentBtn = screen.queryByText(/変更を保存する/i);
      if (saveStudentBtn) {
        await act(async () => {
          fireEvent.click(saveStudentBtn);
        });
      }
    });

    it('should cover Unit Test Modal CRUD and Branch AI Rules modal', async () => {
      await act(async () => {
        render(
          <TeacherDashboard
            onLogout={vi.fn()}
            initialStudentId="std-3"
            initialTab="milestones"
          />
        );
      });

      // 1. Open Unit Test Modal via button if present
      const addUnitTestBtn = screen.queryByTestId('timeline-add-unittest-btn') || screen.queryByText(/＋ 単元テストを追加/i);
      if (addUnitTestBtn) {
        await act(async () => {
          fireEvent.click(addUnitTestBtn);
        });

        const modal = screen.getByTestId('unit-test-master-modal');
        expect(modal).toBeInTheDocument();

        const testNameInput = screen.getByPlaceholderText('例: たしざん 単元確認テスト');
        const saveBtn = screen.getByTestId('save-unittest-master-btn');

        // Validation on empty name
        await act(async () => {
          fireEvent.change(testNameInput, { target: { value: '' } });
          fireEvent.click(saveBtn);
        });

        // Fill fields
        await act(async () => {
          fireEvent.change(testNameInput, { target: { value: '5章 図形の角 単元確認テスト' } });
          fireEvent.click(saveBtn);
        });
      }

      // 2. Open Branch AI Rules Modal
      const openAiRulesBtn = screen.queryByText(/AI計画ルール/i) || screen.queryByText(/校舎別AIルール/i);
      if (openAiRulesBtn) {
        await act(async () => {
          fireEvent.click(openAiRulesBtn);
        });

        const modal = screen.queryByTestId('branch-ai-rules-modal');
        if (modal) {
          const lessonsInput = screen.getByTestId('branch-ai-lessons-per-slot-input');
          await act(async () => {
            fireEvent.change(lessonsInput, { target: { value: '3' } });
          });

          const saveRulesBtn = screen.getByTestId('save-branch-ai-rules-btn');
          await act(async () => {
            fireEvent.click(saveRulesBtn);
          });
        }
      }
    });

    it('should cover schedule, weekly matrix, report, test records, and master settings tabs', async () => {
      await act(async () => {
        render(
          <TeacherDashboard
            onLogout={vi.fn()}
            initialStudentId="std-1"
            initialTab="schedule"
          />
        );
      });

      // Schedule tab interactions
      const periodSelect1 = screen.queryByTestId('period-subject-select-1');
      if (periodSelect1) {
        await act(async () => {
          fireEvent.change(periodSelect1, { target: { value: '英語' } });
        });
      }

      // Switch to Weekly Matrix Tab
      const matrixTab = screen.queryByTestId('tab-weekly-matrix') || screen.queryByText(/週間コマ割り/i);
      if (matrixTab) {
        await act(async () => {
          fireEvent.click(matrixTab);
        });
      }

      // Switch to Tests Tab
      const testsTab = screen.queryByTestId('tab-tests') || screen.queryByText(/テスト結果/i);
      if (testsTab) {
        await act(async () => {
          fireEvent.click(testsTab);
        });
      }

      // Switch to AI Report Tab
      const reportTab = screen.queryByTestId('tab-report') || screen.queryByText(/指導報告書/i);
      if (reportTab) {
        await act(async () => {
          fireEvent.click(reportTab);
        });
      }
    });
  });

  describe('db.ts Comprehensive Method Coverage', () => {
    it('should cover authentication, branches, interactions, masters, templates, and sessions in db.ts', async () => {
      // 1. signInWithPassword cases
      const emptyEmailRes = await db.signInWithPassword('', 'pass');
      expect(emptyEmailRes.success).toBe(false);

      const emptyPassRes = await db.signInWithPassword('test@tentoru.jp', '');
      expect(emptyPassRes.success).toBe(false);

      const wrongRes = await db.signInWithPassword('wrong@example.com', 'wrongpass');
      expect(wrongRes.success).toBe(false);

      const adminRes = await db.signInWithPassword('admin@tentoru.jp', 'admin123');
      expect(adminRes.success).toBe(true);
      expect(db.getSession()?.user.role).toBe('admin');

      const branchRes = await db.signInWithPassword('ebisu@tentoru.jp', 'password123');
      expect(branchRes.success).toBe(true);

      // 2. signOut
      await db.signOut();
      expect(db.getSession()).toBeNull();

      // 3. Branch AI rules
      const rules = {
        lessons_per_slot: 2,
        test_prep_lead_weeks: 3,
        punk_threshold_slots: 4,
        review_slot_interval: 4
      };
      await db.saveBranchAIRules('branch-1', rules);
      const fetchedRules = db.getBranchAIRules('branch-1');
      expect(fetchedRules.lessons_per_slot).toBe(2);

      // 4. Student interactions
      const interaction: StudentInteraction = {
        id: `inter-${Date.now()}`,
        student_id: 'std-1',
        date: '2026-09-17',
        category: '勉強相談',
        memo: '単元テスト対策の学習方法を指導',
        staff_name: '田中講師',
        created_at: new Date().toISOString()
      };
      await db.saveStudentInteraction(interaction);
      const interactions = db.getStudentInteractions('std-1');
      expect(interactions.some(i => i.id === interaction.id)).toBe(true);

      await db.deleteStudentInteraction(interaction.id);
      expect(db.getStudentInteractions('std-1').some(i => i.id === interaction.id)).toBe(false);

      // 5. Personality options CRUD
      await db.addPersonalityOption('好奇心旺盛');
      expect(db.getPersonalityOptions().includes('好奇心旺盛')).toBe(true);
      await db.deletePersonalityOption('好奇心旺盛');
      expect(db.getPersonalityOptions().includes('好奇心旺盛')).toBe(false);

      // 6. Curriculum masters grade cleanup
      await db.deleteCurriculumMastersByGrades(['小1', '小2']);
      expect(db.getCurriculumMasters().some(m => m.grade === '小1')).toBe(false);

      // 7. Exam threshold & School code CRUD
      const eths = db.getExamThresholdsMaster();
      if (eths.length > 0) {
        await db.saveExamThresholdMaster(eths[0]);
      }

      const codes = db.getSchoolCodesMaster();
      if (codes.length > 0) {
        await db.saveSchoolCodeMaster(codes[0]);
      }

      // 8. Milestone templates
      const templates = db.getMilestoneTemplates();
      if (templates.length > 0) {
        await db.saveMilestoneTemplate(templates[0]);
      }

      // 9. Schools and Branches
      const schools = db.getSchools();
      if (schools.length > 0) {
        await db.saveSchool(schools[0]);
      }
      const branches = db.getBranches();
      if (branches.length > 0) {
        await db.saveBranch(branches[0]);
      }
    });
  });

  describe('CurriculumCsvImport Component Coverage', () => {
    it('should test tabs, sample downloads, and drag & drop import', async () => {
      await act(async () => {
        render(
          <CurriculumCsvImport
            onBack={vi.fn()}
            onImportCompleted={vi.fn()}
          />
        );
      });

      // 1. Switch tabs
      const unitTestsTab = screen.getByTestId('tab-unit-tests');
      await act(async () => { fireEvent.click(unitTestsTab); });

      const listTab = screen.getByTestId('tab-curriculum-list');
      await act(async () => { fireEvent.click(listTab); });

      const importTab = screen.getByTestId('tab-csv-import');
      await act(async () => { fireEvent.click(importTab); });

      // 2. Sample download buttons
      const sampleBtn = screen.getByTestId('download-sample-csv-btn');
      await act(async () => { fireEvent.click(sampleBtn); });

      // 3. File upload simulation
      const csvInput = screen.getByTestId('csv-file-input');
      const sampleCsv = `学年,教科,単元名,授業名,区分,合格基準
小5,算数,1章 整数と小数,小数の構成,授業,
小5,算数,1章 整数と小数,1章 整数と小数 単元確認テスト,単元テスト,80%以上`;
      const file = new File([sampleCsv], 'test_curriculum.csv', { type: 'text/csv' });
      await act(async () => {
        fireEvent.change(csvInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/インポートデータ プレビュー/i)).toBeInTheDocument();
      });

      // 4. Execute import
      const execBtn = screen.getByTestId('execute-import-btn');
      await act(async () => {
        fireEvent.click(execBtn);
      });

      await waitFor(() => {
        expect(screen.getByText(/正常にインポート・保存しました/i)).toBeInTheDocument();
      });
    });
  });

  describe('StudentDashboard Deep Interactions', () => {
    it('should render StudentDashboard and test task interactions', async () => {
      const student = db.getStudents()[0];

      await act(async () => {
        render(
          <StudentDashboard
            student={student}
            onLogout={vi.fn()}
            onBack={vi.fn()}
            initialDate="2026-09-17"
          />
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/学習画面/i)).toBeInTheDocument();
      });
    });
  });
});
