import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { username, password, role, shopId } = await request.json();
    
    // Use service role key to create users
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create auth user with email format username@wineshop.local
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: `${username}@wineshop.local`,
      password: password,
      email_confirm: true,
    });

    if (authError) throw authError;

    // Insert into users table
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        username: username,
        role: role,
        shop_id: shopId || null,
      });

    if (userError) throw userError;

    return NextResponse.json({ success: true, user: authData.user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
