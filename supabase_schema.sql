-- ==============================================================================
-- SummitAttend Smart Attendance System - Supabase PostgreSQL Schema
-- Migration from Firebase / SQLite to Supabase with Row Level Security (RLS)
-- ==============================================================================

-- 1. SECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.sections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    year TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SUBJECTS TABLE
CREATE TABLE IF NOT EXISTS public.subjects (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ADMINS TABLE
CREATE TABLE IF NOT EXISTS public.admins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    phone TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TEACHERS TABLE
CREATE TABLE IF NOT EXISTS public.teachers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL,
    assigned_subjects JSONB DEFAULT '[]'::jsonb,
    assigned_sections JSONB DEFAULT '[]'::jsonb,
    password TEXT DEFAULT 'pass',
    phone TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. STUDENTS TABLE
CREATE TABLE IF NOT EXISTS public.students (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    usn TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    section_id TEXT NOT NULL REFERENCES public.sections(id) ON DELETE RESTRICT,
    password TEXT DEFAULT 'pass',
    phone TEXT DEFAULT '',
    parent_name TEXT DEFAULT '',
    parent_phone TEXT DEFAULT '',
    face_registered BOOLEAN DEFAULT FALSE,
    face_descriptor JSONB DEFAULT '[]'::jsonb,
    face_image TEXT DEFAULT '',
    face_enrolled_at TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ACTIVE SESSIONS TABLE (For QR Code Scanning)
CREATE TABLE IF NOT EXISTS public.active_sessions (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    timer_minutes INT NOT NULL,
    started_at TEXT NOT NULL,
    present_students JSONB DEFAULT '[]'::jsonb,
    hash TEXT NOT NULL,
    teacher_lat DOUBLE PRECISION DEFAULT 0.0,
    teacher_lng DOUBLE PRECISION DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ATTENDANCE RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id TEXT PRIMARY KEY,
    student_name TEXT NOT NULL,
    usn TEXT NOT NULL,
    subject TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    status TEXT NOT NULL,
    blockchain_hash TEXT NOT NULL,
    location_lat DOUBLE PRECISION DEFAULT 0.0,
    location_lng DOUBLE PRECISION DEFAULT 0.0,
    verified BOOLEAN DEFAULT TRUE,
    reason TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. NON-COMPLIANCE (NC) RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.nc_records (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    student_id BIGINT NOT NULL,
    subject_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    date TEXT NOT NULL,
    hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. MARKS TABLE (CIE 1, CIE 2, SEE)
CREATE TABLE IF NOT EXISTS public.marks (
    id TEXT PRIMARY KEY,
    student_id BIGINT NOT NULL,
    student_name TEXT NOT NULL,
    usn TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    subject_code TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    section_id TEXT NOT NULL,
    cie1 DOUBLE PRECISION,
    cie2 DOUBLE PRECISION,
    see DOUBLE PRECISION,
    max_cie1 DOUBLE PRECISION DEFAULT 50.0,
    max_cie2 DOUBLE PRECISION DEFAULT 50.0,
    max_see DOUBLE PRECISION DEFAULT 100.0,
    updated_by TEXT DEFAULT '',
    updated_at TEXT DEFAULT '',
    locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. MARKS CONFIG TABLE (Subject Locking)
CREATE TABLE IF NOT EXISTS public.marks_config (
    subject_id TEXT PRIMARY KEY,
    locked BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. OTP VERIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.otp_verifications (
    identifier TEXT NOT NULL,
    purpose TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'email',
    role TEXT NOT NULL DEFAULT 'student',
    otp TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INT DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(identifier, purpose)
);

-- 12. BLOCKCHAIN BLOCKS LEDGER
CREATE TABLE IF NOT EXISTS public.blockchain_blocks (
    index_num BIGINT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    previous_hash TEXT NOT NULL,
    current_hash TEXT NOT NULL,
    nonce INT NOT NULL,
    data_json JSONB NOT NULL,
    merkle_root TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES FOR HIGH-PERFORMANCE QUERIES ───
CREATE INDEX IF NOT EXISTS idx_students_usn ON public.students(usn);
CREATE INDEX IF NOT EXISTS idx_students_email ON public.students(email);
CREATE INDEX IF NOT EXISTS idx_students_section ON public.students(section_id);
CREATE INDEX IF NOT EXISTS idx_attendance_usn ON public.attendance_records(usn);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_marks_student_id ON public.marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_usn ON public.marks(usn);
CREATE INDEX IF NOT EXISTS idx_marks_subject_id ON public.marks(subject_id);

-- ─── ROW LEVEL SECURITY (RLS) POLICIES ───
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blockchain_blocks ENABLE ROW LEVEL SECURITY;

-- Allow anon and authenticated clients to read curriculum and public roster
CREATE POLICY "Public read for sections" ON public.sections FOR SELECT USING (true);
CREATE POLICY "Public read for subjects" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "Public read for students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Public read for teachers" ON public.teachers FOR SELECT USING (true);
CREATE POLICY "Public read for marks" ON public.marks FOR SELECT USING (true);
CREATE POLICY "Public read for attendance" ON public.attendance_records FOR SELECT USING (true);
CREATE POLICY "Public read for active_sessions" ON public.active_sessions FOR SELECT USING (true);
CREATE POLICY "Public read for marks_config" ON public.marks_config FOR SELECT USING (true);

-- Allow full mutations for service role and client-side sync
CREATE POLICY "Allow all mutations on sections" ON public.sections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all mutations on subjects" ON public.subjects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all mutations on students" ON public.students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all mutations on teachers" ON public.teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all mutations on admins" ON public.admins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all mutations on marks" ON public.marks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all mutations on marks_config" ON public.marks_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all mutations on attendance_records" ON public.attendance_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all mutations on active_sessions" ON public.active_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all mutations on nc_records" ON public.nc_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all mutations on otp_verifications" ON public.otp_verifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all mutations on blockchain_blocks" ON public.blockchain_blocks FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime replication on active_sessions, attendance_records, marks, and students
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.students;

