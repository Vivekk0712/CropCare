import { createClient } from '@supabase/supabase-js'

// Create a single supabase client for interacting with your database
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qblzvwtmglcpzfwioute.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFibHp2d3RtZ2xjcHpmd2lvdXRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzNzYwNTksImV4cCI6MjA1OTk1MjA1OX0.svFKQ-8fDSNZHRFov4HQ9MOAQjVO5nF2i16qk433iS0'

export const supabase = createClient(supabaseUrl, supabaseKey) 