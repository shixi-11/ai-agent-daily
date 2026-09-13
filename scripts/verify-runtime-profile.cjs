const fs = require('node:fs');
const path = require('node:path');
function verify(config, contract, agentId) {
  const profile = contract.runtimeProfile;
  if (profile?.model !== 'openai/gpt-6-astra' || profile?.thinking !== 'low' || !Array.isArray(profile.fallbacks) || profile.fallbacks.length) throw new Error('Daily requires openai/gpt-6-astra, thinking=low and no fallbacks.');
  const agents = config.agents || {};
  const entry = agents.entries?.[agentId] || agents.list?.find(a => a.id === agentId) || {};
  const policy = entry.modelPolicy ?? agents.defaults?.modelPolicy;
  const allow = policy?.allow;
  const matches = p => new RegExp('^' + p.split('*').map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(profile.model);
  if (Array.isArray(allow) && allow.length && !allow.some(matches)) throw new Error(`Daily model ${profile.model} conflicts with the effective model allowlist.`);
  return {ok:true, model:profile.model, thinking:profile.thinking};
}
if (require.main === module) {
  try {
    const configPath = process.argv[2];
    if (!configPath) throw new Error('Usage: node verify-runtime-profile.cjs <openclaw-config> [contract] [agent-id]');
    const contractPath = process.argv[3] || path.join(__dirname, '../automation/task-contract.json');
    console.log(JSON.stringify(verify(JSON.parse(fs.readFileSync(configPath)), JSON.parse(fs.readFileSync(contractPath)), process.argv[4] || 'xixingdafa_agent')));
  } catch (e) { console.error('DAILY_CONFIG_BLOCKED: ' + e.message); process.exitCode=78; }
}
module.exports={verify};
