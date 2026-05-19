const supabase = require('../src/config/supabase');

const run = async () => {
  try {
    const { data: regs, error } = await supabase
      .from('registrations')
      .select('*')
      .ilike('full_name', '%Manicar%');
    if (error) throw error;

    console.log('--- Duplicate Registration Records for Jaimes Aldrich T. Manicar ---');
    console.log(JSON.stringify(regs, null, 2));

  } catch (err) {
    console.error(err);
  }
};

run();
