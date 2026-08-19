import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/db';

const DEFAULT_TARGET_GRADES = ['小1', '小2', '小3', '小4', '小5', '小6', '中3'];

export async function POST(req: NextRequest) {
  return handleCleanup(req);
}

export async function DELETE(req: NextRequest) {
  return handleCleanup(req);
}

async function handleCleanup(req: NextRequest) {
  try {
    let targetGrades = DEFAULT_TARGET_GRADES;
    let isAllGrades = false;
    try {
      const body = await req.json();
      if (body) {
        if (Array.isArray(body.grades) && body.grades.length > 0) {
          targetGrades = body.grades;
        } else if (Array.isArray(body.target_grades) && body.target_grades.length > 0) {
          targetGrades = body.target_grades;
        } else if ((Array.isArray(body.target_grades) && body.target_grades.length === 0) || (Array.isArray(body.grades) && body.grades.length === 0) || Object.keys(body).length === 0) {
          isAllGrades = true;
        }
      }
    } catch {
      // Body not provided or empty JSON, use default
    }

    // Also call db helper to update local state / DB if applicable
    await db.deleteCurriculumMastersByGrades(targetGrades);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let supabaseDeleted = false;
    let errors: any[] = [];

    if (supabaseUrl && serviceRoleKey) {
      try {
        const supabase = createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });

        // 1. Delete matching grade_level column
        const { error: err1 } = await supabase
          .from('curriculum_masters')
          .delete()
          .in('grade_level', targetGrades);

        if (err1) {
          errors.push({ type: 'grade_level_delete_error', error: err1 });
        }

        // 2. Delete matching grade column (backwards compatibility)
        const { error: err2 } = await supabase
          .from('curriculum_masters')
          .delete()
          .in('grade', targetGrades);

        if (err2) {
          errors.push({ type: 'grade_delete_error', error: err2 });
        }

        supabaseDeleted = true;
      } catch (err: any) {
        errors.push({ type: 'supabase_client_exception', message: err.message || String(err) });
      }
    }

    return NextResponse.json({
      success: true,
      message: isAllGrades
        ? `全学年のカリキュラムマスターデータを削除しました。`
        : `旧フォーマット（${targetGrades.join(', ')}）のカリキュラムマスターデータを削除しました。`,
      target_grades: targetGrades,
      deleted_grades: targetGrades,
      supabase_connected: Boolean(supabaseUrl && serviceRoleKey),
      supabase_deleted: supabaseDeleted,
      warnings: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'カリキュラムマスターの削除中にエラーが発生しました。'
      },
      { status: 500 }
    );
  }
}
