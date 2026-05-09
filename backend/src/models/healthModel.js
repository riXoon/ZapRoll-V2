const supabase = require('../config/supabase');

const checkDatabaseConnection = async () => {
  try {
    // A simple query to check if we can connect to Supabase
    // We try to fetch the first event or just perform a select 1
    const { data, error } = await supabase.from('_dummy_query_').select('*').limit(1);
    
    // Supabase doesn't have a direct ping, so we check if the error is a connection error
    // If we get an error like "relation _dummy_query_ does not exist", it means we ARE connected
    if (error && error.code !== 'PGRST116' && error.message.includes('FetchError')) {
      return { connected: false, message: error.message };
    }
    
    return { connected: true, message: 'Successfully reached Supabase API' };
  } catch (err) {
    return { connected: false, message: err.message };
  }
};

module.exports = {
  checkDatabaseConnection
};
