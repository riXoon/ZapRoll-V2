const supabase = require('../config/supabase');

const getProfileByUserId = async (userId) => {
  const { data, error } = await supabase
    .from('admin_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return data;
};

module.exports = {
  getProfileByUserId
};
