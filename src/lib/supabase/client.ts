
import { createClient } from '@supabase/supabase-js';

// Fallback values in case .env.local is not loaded correctly or blocked
const UP_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yzjmoddhfhpkyixnbdtb.supabase.co";
const UP_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6am1vZGRoZmhwa3lpeG5iZHRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyNjUwNzUsImV4cCI6MjA4Mjg0MTA3NX0.A9LCmPWEXE8iew9fNQDzMTzZ-CorudaVLH9FdC6irkk";

export const supabase = createClient(UP_URL, UP_KEY);
