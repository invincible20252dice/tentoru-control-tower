import React from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App, { getSavedTeacherType, filterStudentByGradeCategory } from '../app/page';
import { db, Student } from '../lib/db';

let teacherDashboardProps: any = null;
let studentDashboardProps: any = null;
let loginFormProps: any = null;

vi.mock('../components/TeacherDashboard', () => {
  return {
    default: (props: any) => {
      teacherDashboardProps = props;
      return <div data-testid="mock-teacher-dashboard">Mock Teacher Dashboard</div>;
    }
  };
});

vi.mock('../components/StudentDashboard', () => {
  return {
    default: (props: any) => {
      studentDashboardProps = props;
      return <div data-testid="mock-student-dashboard">Mock Student Dashboard</div>;
    }
  };
});

vi.mock('../components/LoginForm', () => {
  return {
    default: (props: any) => {
      loginFormProps = props;
      return <div data-testid="mock-login-form">Mock Login Form</div>;
    },
    LoginForm: (props: any) => {
      loginFormProps = props;
      return <div data-testid="mock-login-form">Mock Login Form</div>;
    }
  };
});

describe('App page.tsx Complete Branch Perfection Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    teacherDashboardProps = null;
    studentDashboardProps = null;
    loginFormProps = null;
  });

  it('covers onDateChange, onViewStudentScreen with date, portal logout, and handleBackToPortal without session', async () => {
    const mockStudent = {
      id: 'st-app-1',
      student_id: 'std_app',
      name: 'アプリ生徒',
      grade: '中3'
    };

    const sessionObj: any = {
      user: { id: 'u-1', email: 'admin@tentoru.jp', role: 'admin' },
      access_token: 'token'
    };

    vi.spyOn(db, 'getSession').mockReturnValue(sessionObj);
    vi.spyOn(db, 'getStudents').mockReturnValue([mockStudent as any]);
    vi.spyOn(db, 'getBranches').mockReturnValue([]);
    vi.spyOn(db, 'signOut').mockResolvedValue();

    render(<App />);

    // 1. Initial view is TeacherDashboard
    expect(screen.getByTestId('mock-teacher-dashboard')).toBeDefined();

    // 2. onDateChange (line 216)
    act(() => {
      teacherDashboardProps.onDateChange('2026-11-20');
    });

    // 3. onViewStudentScreen with date (line 206 truthy)
    act(() => {
      teacherDashboardProps.onViewStudentScreen(mockStudent, '2026-11-22');
    });
    expect(screen.getByTestId('mock-student-dashboard')).toBeDefined();

    // 4. onGoToTeacherSchedule (lines 232-237)
    act(() => {
      studentDashboardProps.onGoToTeacherSchedule(mockStudent.id, '2026-11-25');
    });
    expect(screen.getByTestId('mock-teacher-dashboard')).toBeDefined();

    // 4-b. onViewStudentScreen without date (line 206 falsy)
    act(() => {
      teacherDashboardProps.onViewStudentScreen(mockStudent, undefined);
    });
    expect(screen.getByTestId('mock-student-dashboard')).toBeDefined();

    act(() => {
      studentDashboardProps.onGoToTeacherSchedule(mockStudent.id, '2026-11-25');
    });
    expect(screen.getByTestId('mock-teacher-dashboard')).toBeDefined();

    // 5. onBackToPortal (with session -> portal)
    act(() => {
      teacherDashboardProps.onBackToPortal();
    });
    expect(screen.getByTestId('portal-logout-btn')).toBeDefined();

    // 6. portal logout (async handleLogout)
    await act(async () => {
      fireEvent.click(screen.getByTestId('portal-logout-btn'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('mock-login-form')).toBeDefined();
    });
  });

  it('covers handleBackToPortal when session is null (line 164)', async () => {
    vi.spyOn(db, 'getSession').mockReturnValue(null);
    vi.spyOn(db, 'getStudents').mockReturnValue([]);
    vi.spyOn(db, 'getBranches').mockReturnValue([]);

    render(<App />);

    // Initial view is LoginForm
    expect(screen.getByTestId('mock-login-form')).toBeDefined();

    // Trigger onLoginSuccess with null/falsy session to keep session state null
    act(() => {
      loginFormProps.onLoginSuccess(null as any);
    });

    // Switches to TeacherDashboard
    expect(screen.getByTestId('mock-teacher-dashboard')).toBeDefined();

    // Now call onBackToPortal when session is null -> triggers line 164: setCurrentView('login')
    act(() => {
      teacherDashboardProps.onBackToPortal();
    });

    // Successfully returns to LoginForm
    expect(screen.getByTestId('mock-login-form')).toBeDefined();
  });

  it('covers getSavedTeacherType and filterStudentByGradeCategory pure functions all branches', () => {
    // getSavedTeacherType
    localStorage.setItem('tentoru_teacher_type', 'elementary');
    expect(getSavedTeacherType()).toBe('elementary');

    localStorage.setItem('tentoru_teacher_type', 'high_school');
    expect(getSavedTeacherType()).toBe('high_school');

    localStorage.setItem('tentoru_teacher_type', 'junior_high');
    expect(getSavedTeacherType()).toBe('junior_high');

    localStorage.setItem('tentoru_teacher_type', 'invalid_val');
    expect(getSavedTeacherType()).toBe('junior_high');

    // Test typeof window === 'undefined' branch (line 34)
    const originalWindow = global.window;
    try {
      // @ts-ignore
      delete global.window;
      expect(getSavedTeacherType()).toBe('junior_high');
    } finally {
      global.window = originalWindow;
    }

    // filterStudentByGradeCategory
    const stElem = { grade: '小5' } as Student;
    const stEnji = { grade: '園児' } as Student;
    const stJhs = { grade: '中2' } as Student;
    const stHigh = { grade: '高1' } as Student;
    const stGrad = { grade: '既卒' } as Student;
    const stOther = { grade: '一般' } as Student;

    expect(filterStudentByGradeCategory(stElem, '')).toBe(false);
    expect(filterStudentByGradeCategory(stElem, 'elementary')).toBe(true);
    expect(filterStudentByGradeCategory(stEnji, 'elementary')).toBe(true);
    expect(filterStudentByGradeCategory(stJhs, 'elementary')).toBe(false);

    expect(filterStudentByGradeCategory(stJhs, 'junior_high')).toBe(true);
    expect(filterStudentByGradeCategory(stElem, 'junior_high')).toBe(false);

    expect(filterStudentByGradeCategory(stHigh, 'high_school')).toBe(true);
    expect(filterStudentByGradeCategory(stGrad, 'high_school')).toBe(true);
    expect(filterStudentByGradeCategory(stJhs, 'high_school')).toBe(false);

    expect(filterStudentByGradeCategory(stOther, 'elementary')).toBe(false);
  });
});
