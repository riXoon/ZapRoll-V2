import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-placeholder-url.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'your-placeholder-anon-key';
export const supabase = createClient(supabaseUrl, supabaseKey);
