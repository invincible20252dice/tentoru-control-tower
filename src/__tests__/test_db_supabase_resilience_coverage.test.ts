import { describe, it, expect, vi, beforeEach } from "vitest";
import { db, DatabaseService } from "../lib/db";

describe("DatabaseService Supabase Resilience & Error Recovery Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should cover PGRST204 missing column recovery in saveStudent", async () => {
    const localDb = new (db.constructor as any)();
    (localDb as any).isMockMode = false;

    let attemptCount = 0;
    (localDb as any).supabase = {
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: "error" } })
            })
          })
        }),
        upsert: vi.fn().mockImplementation((payload: any) => {
          attemptCount++;
          if (attemptCount === 1) {
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: {
                    code: "PGRST204",
                    message: "Could not find the 'school_name' column in the schema cache"
                  }
                })
              })
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "res-std-1", student_id: "S001", name: "テスト生徒" },
                error: null
              })
            })
          };
        })
      }))
    };

    const std = await localDb.saveStudent({
      id: "std-1",
      student_id: "S001",
      name: "テスト生徒",
      grade: "中1",
      status: "normal",
      school_name: "架空中学校" as any,
      created_at: new Date().toISOString()
    });

    expect(std.id).toBe("res-std-1");
  });

  it("should cover 23505 unique constraint violation recovery in saveStudent", async () => {
    const localDb = new (db.constructor as any)();
    (localDb as any).isMockMode = false;

    (localDb as any).supabase = {
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "updated-23505-id", student_id: "S_DUP_1", email: "dup@example.com" },
                error: null
              })
            })
          })
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: {
                code: "23505",
                message: "duplicate key value violates unique constraint \"students_email_key\""
              }
            })
          })
        })
      }))
    };

    const std = await localDb.saveStudent({
      id: "std-dup-1",
      student_id: "S_DUP_1",
      name: "重複 生徒",
      email: "dup@example.com",
      grade: "中2",
      status: "normal",
      created_at: new Date().toISOString()
    });

    expect(std.id).toBe("updated-23505-id");
  });

  it("should cover 22P02 invalid UUID syntax recovery in saveStudent", async () => {
    const localDb = new (db.constructor as any)();
    (localDb as any).isMockMode = false;

    let upsertAttempt = 0;
    (localDb as any).supabase = {
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: "err" } })
            })
          })
        }),
        upsert: vi.fn().mockImplementation((payload: any) => {
          upsertAttempt++;
          if (upsertAttempt === 1) {
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: {
                    code: "22P02",
                    message: "invalid input syntax for type uuid"
                  }
                })
              })
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "recovered-uuid-std", student_id: "S_UUID_1" },
                error: null
              })
            })
          };
        })
      }))
    };

    const std = await localDb.saveStudent({
      id: "not-a-valid-uuid",
      student_id: "S_UUID_1",
      name: "UUID生徒",
      grade: "中3",
      status: "normal",
      created_at: new Date().toISOString()
    });

    expect(std.id).toBe("recovered-uuid-std");
  });

  it("should cover minimal fallback payload branch in saveStudent", async () => {
    const localDb = new (db.constructor as any)();
    (localDb as any).isMockMode = false;

    let count = 0;
    (localDb as any).supabase = {
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: "err" } })
            })
          })
        }),
        upsert: vi.fn().mockImplementation((payload: any) => {
          count++;
          if (count < 2) {
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: "500", message: "Unknown schema issue" }
                })
              })
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "minimal-fb-std", student_id: "S_MIN_1" },
                error: null
              })
            })
          };
        })
      }))
    };

    const std = await localDb.saveStudent({
      id: "minimal-std-1",
      student_id: "S_MIN_1",
      name: "最小生徒",
      grade: "小5",
      status: "normal",
      created_at: new Date().toISOString()
    });

    expect(std.id).toBe("minimal-fb-std");
  });
});
