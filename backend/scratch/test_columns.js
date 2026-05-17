const supabase = require('../src/config/supabase');

const run = async () => {
  try {
    console.log('Querying evaluation_responses columns via API/RPC or by fetching 1 row...');
    const { data: erData, error: erError } = await supabase.from('evaluation_responses').select('*').limit(1);
    if (erError) throw erError;
    console.log('evaluation_responses keys:', erData.length > 0 ? Object.keys(erData[0]) : 'No rows');

    const { data: vData, error: vError } = await supabase.from('v_certificate_eligibility').select('*').limit(1);
    if (vError) throw vError;
    console.log('v_certificate_eligibility keys:', vData.length > 0 ? Object.keys(vData[0]) : 'No rows');
  } catch (error) {
    console.error('Error:', error);
  }
};

run();
