import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db, Branch } from '../../../../../lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, code, phone, address } = body;

    if (!name || !email) {
      return NextResponse.json({ error: '校舎名とメールアドレスは必須です' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    let authUser: any = null;

    if (supabaseUrl && serviceRoleKey) {
      try {
        const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });

        // Create Supabase Auth User with admin API
        const { data: createdUser, error: authError } = await adminSupabase.auth.admin.createUser({
          email: email.trim(),
          password: password || 'Tentoru2026!',
          email_confirm: true,
          user_metadata: {
            role: 'branch',
            branch_name: name.trim(),
            branch_code: code?.trim().toUpperCase() || name.toUpperCase(),
          }
        });

        if (authError) {
          console.warn('Supabase auth.admin.createUser error:', authError);
        } else {
          authUser = createdUser?.user;
        }
      } catch (err) {
        console.warn('Admin Supabase Client Error:', err);
      }
    }

    // Save branch in database
    const newBranch = await db.createBranchAccount({
      name,
      email,
      password,
      code,
      phone,
      address
    });

    return NextResponse.json({
      success: true,
      branch: newBranch,
      authUserId: authUser?.id || null,
      message: `校舎アカウント「${name}」を発行しました。`
    });
  } catch (error: any) {
    console.error('API /admin/branches/create Error:', error);
    return NextResponse.json(
      { error: error?.message || 'アカウント発行に失敗しました' },
      { status: 500 }
    );
  }
}
