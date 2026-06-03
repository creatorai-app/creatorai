export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const axios = (await import('axios')).default;
  const { installCreatorAiAxiosDefaults } = await import('@repo/validation');
  installCreatorAiAxiosDefaults(axios);
}
