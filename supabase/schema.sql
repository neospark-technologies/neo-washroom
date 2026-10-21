-- ==============================================================================
-- NeoSpark Toilet Management System: Complete Database Schema
-- Run this in your Supabase Project's SQL Editor (Dashboard > SQL Editor > New Query)
-- ==============================================================================

-- 1. Toilets Table
CREATE TABLE IF NOT EXISTS public.toilets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
    queue_count INTEGER NOT NULL DEFAULT 0 CHECK (queue_count >= 0),
    last_status_update TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.toilets ADD COLUMN IF NOT EXISTS queue_count INTEGER NOT NULL DEFAULT 0;

-- 2. Status History (Audit Log for Toilet Statuses)
CREATE TABLE IF NOT EXISTS public.toilet_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    toilet_id TEXT NOT NULL REFERENCES public.toilets(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL CHECK (new_status IN ('available', 'occupied', 'maintenance')),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Supply Reports Table
CREATE TABLE IF NOT EXISTS public.supply_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    toilet_id TEXT NOT NULL REFERENCES public.toilets(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('Soap', 'Toilet paper', 'Paper towels', 'Hand sanitizer', 'Other')),
    description TEXT CHECK (char_length(description) <= 500),
    severity TEXT NOT NULL DEFAULT 'Normal' CHECK (severity IN ('Normal', 'Urgent')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
    resolution_note TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    resolved_at TIMESTAMPTZ
);

-- 4. Cleaning Schedules Table (For expected cleaning tasks denominator)
CREATE TABLE IF NOT EXISTS public.cleaning_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    toilet_id TEXT NOT NULL REFERENCES public.toilets(id) ON DELETE CASCADE,
    time_of_day TEXT NOT NULL, -- Format: 'HH:MI', e.g., '09:00', '13:00', '17:00'
    shift_name TEXT NOT NULL, -- e.g. 'Morning Inspection', 'Midday Clean', 'Evening Refresh'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Cleaning Logs Table
CREATE TABLE IF NOT EXISTS public.cleaning_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    toilet_id TEXT NOT NULL REFERENCES public.toilets(id) ON DELETE CASCADE,
    cleaned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    staff_identifier TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Administrative Audit Logs Table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- Indexes for Performance
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_status_history_toilet_created 
    ON public.toilet_status_history (toilet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_status_history_new_status 
    ON public.toilet_status_history (new_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_supply_reports_status 
    ON public.supply_reports (status, is_archived, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_supply_reports_toilet 
    ON public.supply_reports (toilet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cleaning_logs_toilet_time 
    ON public.cleaning_logs (toilet_id, cleaned_at DESC);

CREATE INDEX IF NOT EXISTS idx_cleaning_schedules_toilet 
    ON public.cleaning_schedules (toilet_id, is_active);

-- ==============================================================================
-- Atomic Status Update Function
-- Ensures atomic toilet update + audit log insert and avoids duplicate events
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.update_toilet_status(
    p_toilet_id TEXT,
    p_new_status TEXT,
    p_ip TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status TEXT;
    v_last_update TIMESTAMPTZ;
    v_updated_toilet RECORD;
BEGIN
    IF p_new_status NOT IN ('available', 'occupied', 'maintenance') THEN
        RAISE EXCEPTION 'Invalid status: %', p_new_status;
    END IF;

    SELECT status, last_status_update 
    INTO v_current_status, v_last_update
    FROM public.toilets
    WHERE id = p_toilet_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Toilet not found with ID: %', p_toilet_id;
    END IF;

    -- If status is unchanged, refresh timestamp without inserting duplicate history log
    IF v_current_status = p_new_status THEN
        UPDATE public.toilets
        SET 
            last_status_update = timezone('utc'::text, now()),
            updated_at = timezone('utc'::text, now())
        WHERE id = p_toilet_id
        RETURNING * INTO v_updated_toilet;

        RETURN jsonb_build_object(
            'changed', false,
            'refreshed', true,
            'previous_status', v_current_status,
            'toilet', row_to_json(v_updated_toilet)
        );
    END IF;

    -- Update toilet with new status and fresh timestamp
    UPDATE public.toilets
    SET 
        status = p_new_status,
        last_status_update = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_toilet_id
    RETURNING * INTO v_updated_toilet;

    -- Record atomic history log
    INSERT INTO public.toilet_status_history (
        toilet_id,
        previous_status,
        new_status,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        p_toilet_id,
        v_current_status,
        p_new_status,
        p_ip,
        p_user_agent,
        timezone('utc'::text, now())
    );

    RETURN jsonb_build_object(
        'changed', true,
        'previous_status', v_current_status,
        'toilet', row_to_json(v_updated_toilet)
    );
END;
$$;

-- ==============================================================================
-- Initial Seed Data
-- ==============================================================================

INSERT INTO public.toilets (id, name, status, last_status_update)
VALUES 
    ('mens', 'Men''s Toilet', 'available', timezone('utc'::text, now())),
    ('womens', 'Women''s Toilet', 'available', timezone('utc'::text, now()))
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name;

INSERT INTO public.cleaning_schedules (toilet_id, time_of_day, shift_name)
VALUES
    ('mens', '09:00', 'Morning Inspection'),
    ('mens', '13:00', 'Midday Sanitization'),
    ('mens', '17:00', 'Evening Deep Clean'),
    ('womens', '09:00', 'Morning Inspection'),
    ('womens', '13:00', 'Midday Sanitization'),
    ('womens', '17:00', 'Evening Deep Clean')
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- Row Level Security (RLS) Policies
-- ==============================================================================

ALTER TABLE public.toilets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toilet_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public toilets select" ON public.toilets FOR SELECT USING (true);
CREATE POLICY "Public toilets update" ON public.toilets FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Public status history select" ON public.toilet_status_history FOR SELECT USING (true);
CREATE POLICY "Public status history insert" ON public.toilet_status_history FOR INSERT WITH CHECK (true);

CREATE POLICY "Public supply reports select" ON public.supply_reports FOR SELECT USING (is_archived = false);
CREATE POLICY "Public supply reports insert" ON public.supply_reports FOR INSERT WITH CHECK (status = 'pending' AND is_archived = false);
CREATE POLICY "Public supply reports update" ON public.supply_reports FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public supply reports delete" ON public.supply_reports FOR DELETE USING (true);

CREATE POLICY "Public cleaning schedules select" ON public.cleaning_schedules FOR SELECT USING (true);
CREATE POLICY "Public cleaning logs select" ON public.cleaning_logs FOR SELECT USING (true);
CREATE POLICY "Public cleaning logs insert" ON public.cleaning_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Public admin audit logs select" ON public.admin_audit_logs FOR SELECT USING (true);
CREATE POLICY "Public admin audit logs insert" ON public.admin_audit_logs FOR INSERT WITH CHECK (true);
