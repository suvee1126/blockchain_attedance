import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://qheqjumkbqczmygfymwe.supabase.co';
const supabaseKey = 'sb_publishable_hp-QiVaif8bW6GDtWzweyw_O3But7xN';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('='.repeat(60));
  console.log('🚀 UPLOADING SQLITE DATA TO SUPABASE');
  console.log('='.repeat(60));

  if (!fs.existsSync('sqlite_data_dump.json')) {
    console.error('sqlite_data_dump.json not found!');
    return;
  }

  const dump = JSON.parse(fs.readFileSync('sqlite_data_dump.json', 'utf-8'));

  const tables = [
    'sections',
    'subjects',
    'admins',
    'teachers',
    'students',
    'active_sessions',
    'attendance_records',
    'nc_records',
    'marks',
    'otp_verifications'
  ];

  for (const table of tables) {
    let rows = dump[table] || [];
    if (rows.length === 0) {
      console.log(`[-] ${table}: 0 records to migrate`);
      continue;
    }

    // Transform specific data types for PostgreSQL compatibility
    if (table === 'teachers') {
      rows = rows.map(r => ({
        id: String(r.id),
        name: r.name,
        email: r.email,
        department: r.department || '',
        assigned_subjects: typeof r.assigned_subjects === 'string' ? JSON.parse(r.assigned_subjects || '[]') : (r.assigned_subjects || []),
        assigned_sections: typeof r.assigned_sections === 'string' ? JSON.parse(r.assigned_sections || '[]') : (r.assigned_sections || []),
        password: r.password || 'pass',
        phone: r.phone || '',
        is_active: Boolean(r.is_active ?? 1),
        is_verified: Boolean(r.is_verified ?? 1)
      }));
    } else if (table === 'students') {
      rows = rows.map(r => ({
        id: Number(r.id),
        name: r.name,
        usn: r.usn,
        email: r.email,
        section_id: String(r.section_id),
        password: r.password || 'pass',
        phone: r.phone || '',
        parent_name: r.parent_name || '',
        parent_phone: r.parent_phone || '',
        face_registered: Boolean(r.face_registered ?? 0),
        face_descriptor: typeof r.face_descriptor === 'string' ? JSON.parse(r.face_descriptor || '[]') : (r.face_descriptor || []),
        face_image: r.face_image || '',
        face_enrolled_at: r.face_enrolled_at || '',
        is_active: Boolean(r.is_active ?? 1),
        is_verified: Boolean(r.is_verified ?? 1)
      }));
    } else if (table === 'admins') {
      rows = rows.map(r => ({
        id: String(r.id),
        name: r.name,
        email: r.email,
        password: r.password,
        phone: r.phone || '',
        is_active: Boolean(r.is_active ?? 1),
        is_verified: Boolean(r.is_verified ?? 1)
      }));
    } else if (table === 'active_sessions') {
      rows = rows.map(r => ({
        ...r,
        present_students: typeof r.present_students === 'string' ? JSON.parse(r.present_students || '[]') : (r.present_students || [])
      }));
    } else if (table === 'attendance_records') {
      rows = rows.map(r => ({
        ...r,
        verified: Boolean(r.verified ?? 1)
      }));
    } else if (table === 'marks') {
      rows = rows.map(r => ({
        ...r,
        locked: Boolean(r.locked ?? 0)
      }));
    } else if (table === 'otp_verifications') {
      rows = rows.map(r => ({
        ...r,
        verified: Boolean(r.verified ?? 0)
      }));
    }

    const { data, error } = await supabase.from(table).upsert(rows);
    if (error) {
      console.error(`[!] ${table} migration error:`, error.message);
    } else {
      console.log(`[+] ${table}: ${rows.length} records successfully synced to Supabase!`);
    }
  }

  console.log('='.repeat(60));
  console.log('✨ Data migration completed successfully!');
  console.log('='.repeat(60));
}

runMigration();
