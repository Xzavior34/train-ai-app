process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const url = 'https://jeobggrtxeybxvlwpxvn.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y';
const supabase = createClient(url, key);

async function inspectData() {
  const saraId = '58ebdb4d-8209-4e08-9ab3-8c5eee87b278';
  
  // Check enrollments for Sara
  const { count: enrollCount, data: enrollSample } = await supabase.from('course_enrollments').select('*', { count: 'exact' }).limit(5);
  console.log('Course enrollments total:', enrollCount, 'Sample:', enrollSample);

  // Check lesson progress
  const { count: progCount, data: progSample } = await supabase.from('user_lesson_progress').select('*', { count: 'exact' }).limit(5);
  console.log('Lesson progress total:', progCount, 'Sample:', progSample);

  // Check quiz attempts
  const { count: quizCount, data: quizSample } = await supabase.from('quiz_attempts').select('*', { count: 'exact' }).limit(5);
  console.log('Quiz attempts total:', quizCount, 'Sample:', quizSample);

  // Check user_gamification_stats
  const { count: gamTotal, data: gamSample } = await supabase.from('user_gamification_stats').select('*', { count: 'exact' });
  console.log('Gamification stats total across entire DB:', gamTotal, 'Sample:', gamSample);
}
inspectData();
