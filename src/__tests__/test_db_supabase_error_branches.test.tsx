import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db, Student, LearningTask, School } from '../lib/db';

describe('db.ts Supabase Error & Edge Branch Tests', () => {
  let originalSupabase: any;
  let originalIsMockMode: boolean;

  beforeEach(() => {
    originalSupabase = db.supabase;
    originalIsMockMode = db.isMockMode;
  });

  afterEach(() => {
    db.supabase = originalSupabase;
    db.isMockMode = originalIsMockMode;
    vi.restoreAllMocks();
  });

  const getDynamicDateStr = (offsetDays = 0): string => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  it('should handle PGRST204 missing column error and retry with stripped column', async () => {
    let attempt = 0;
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: new Error('not found') })
              })
            })
          }),
          upsert: vi.fn().mockImplementation((payload: any) => {
            attempt++;
            if (attempt === 1) {
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: {
                      message: "Could not find the 'obsolete_col' column of 'students' in the schema cache",
                      code: 'PGRST204'
                    }
                  })
                })
              };
            }
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: payload.id, name: payload.name },
                  error: null
                })
              })
            };
          })
        };
      })
    };

    db.supabase = mockSupabase;
    db.isMockMode = false;

    const studentToSave: any = {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'テスト生徒',
      grade: '中1',
      obsolete_col: 'dummy'
    };

    const saved = await db.saveStudent(studentToSave);
    expect(saved).toBeDefined();
    expect(attempt).toBe(2);
  });

  it('should handle 23505 unique constraint violation with student_id update', async () => {
    let updateCalled = false;
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        return {
          update: vi.fn().mockImplementation((payload: any) => {
            return {
              eq: vi.fn().mockImplementation((field: string, val: any) => {
                if (field === 'student_id') {
                  updateCalled = true;
                  return {
                    select: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: { id: payload.id, student_id: val, name: payload.name },
                        error: null
                      })
                    })
                  };
                }
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: null, error: new Error('not matched') })
                  })
                };
              })
            };
          }),
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: {
                  code: '23505',
                  message: 'duplicate key value violates unique constraint "students_student_id_key"'
                }
              })
            })
          })
        };
      })
    };

    db.supabase = mockSupabase;
    db.isMockMode = false;

    const studentToSave: any = {
      id: '00000000-0000-4000-8000-000000000002',
      student_id: 'ST-1002',
      name: '重複生徒',
      grade: '中2'
    };

    const saved = await db.saveStudent(studentToSave);
    expect(saved).toBeDefined();
    expect(updateCalled).toBe(true);
  });

  it('should handle 23505 unique constraint violation with email update', async () => {
    let emailUpdateCalled = false;
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        return {
          update: vi.fn().mockImplementation((payload: any) => {
            return {
              eq: vi.fn().mockImplementation((field: string, val: any) => {
                if (field === 'email') {
                  emailUpdateCalled = true;
                  return {
                    select: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: { id: payload.id, email: val, name: payload.name },
                        error: null
                      })
                    })
                  };
                }
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: null, error: new Error('not matched') })
                  })
                };
              })
            };
          }),
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: {
                  code: '23505',
                  message: 'duplicate key value violates unique constraint "students_email_key"'
                }
              })
            })
          })
        };
      })
    };

    db.supabase = mockSupabase;
    db.isMockMode = false;

    const studentToSave: any = {
      id: '00000000-0000-4000-8000-000000000003',
      email: 'duplicate@example.com',
      name: 'メール重複生徒',
      grade: '高1'
    };

    const saved = await db.saveStudent(studentToSave);
    expect(saved).toBeDefined();
    expect(emailUpdateCalled).toBe(true);
  });

  it('should handle 22P02 uuid syntax error and regenerate UUID', async () => {
    let attempt = 0;
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: new Error('update fail') })
              })
            })
          }),
          upsert: vi.fn().mockImplementation((payload: any) => {
            attempt++;
            if (attempt === 1) {
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: {
                      code: '22P02',
                      message: 'invalid input syntax for type uuid: "not-a-uuid"'
                    }
                  })
                })
              };
            }
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: payload.id, name: payload.name },
                  error: null
                })
              })
            };
          })
        };
      })
    };

    db.supabase = mockSupabase;
    db.isMockMode = false;

    const studentToSave: any = {
      id: 'invalid-id-format',
      name: 'UUIDエラー生徒',
      grade: '小6'
    };

    const saved = await db.saveStudent(studentToSave);
    expect(saved).toBeDefined();
    expect(attempt).toBe(2);
  });

  it('should sync schools from students table in fetchSchools', async () => {
    const mockSchools: School[] = [
      { id: '00000000-0000-4000-8000-000000000010', name: '既存中学校', type: 'junior_high', created_at: new Date().toISOString() }
    ];

    const mockStudentsData = [
      { school_name: '新設小学校', school_id: '00000000-0000-4000-8000-000000000011' },
      { school_name: '既存中学校', school_id: '00000000-0000-4000-8000-000000000010' },
      { school_name: '   ', school_id: null }
    ];

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'schools') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockSchools,
                error: null
              })
            })
          };
        }
        if (table === 'students') {
          return {
            select: vi.fn().mockResolvedValue({
              data: mockStudentsData,
              error: null
            })
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null })
        };
      })
    };

    db.supabase = mockSupabase;
    db.isMockMode = false;

    const schools = await db.fetchSchools();
    expect(schools.some(s => s.name === '新設小学校')).toBe(true);
  });

  it('should support deleteLearningTasksForDate and saveLearningTasks with studentId filtering and retry on error', async () => {
    const today = getDynamicDateStr(0);
    let upsertAttempt = 0;
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          }),
          upsert: vi.fn().mockImplementation((payload: any) => {
            upsertAttempt++;
            if (upsertAttempt === 1) {
              return {
                select: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: '23505', message: 'duplicate key value' }
                })
              };
            }
            return {
              select: vi.fn().mockResolvedValue({
                data: payload,
                error: null
              })
            };
          })
        };
      })
    };

    db.supabase = mockSupabase;
    db.isMockMode = false;

    await db.deleteLearningTasksForDate('student-123', today);

    const task: LearningTask = {
      id: 'task-test-1',
      student_id: 'student-123',
      unit_id: 'u-1',
      subject: '数学',
      scheduled_date: today,
      period: 1,
      status: 'scheduled',
      created_at: new Date().toISOString()
    };

    await db.saveLearningTasks([task], 'student-123');
    expect(mockSupabase.from).toHaveBeenCalledWith('learning_tasks');
    expect(upsertAttempt).toBe(2);
  });
});
