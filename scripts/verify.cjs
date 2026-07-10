/**
 * Verify LuckyMilitiaStats on Basescan and Celoscan.
 *
 * Required env vars:
 *   BASESCAN_API_KEY   – from https://basescan.org/myapikey
 *   CELOSCAN_API_KEY   – from https://celoscan.io/myapikey
 *   VITE_MILITIA_CONTRACT_ADDRESS
 *   VITE_CELO_MILITIA_CONTRACT_ADDRESS
 */

const fs   = require('fs');
const path = require('path');
require('dotenv').config();

const BASESCAN_API  = process.env.BASESCAN_API_KEY;
const CELOSCAN_API  = process.env.CELOSCAN_API_KEY;
const BASE_ADDR     = process.env.VITE_MILITIA_CONTRACT_ADDRESS;
const CELO_ADDR     = process.env.VITE_CELO_MILITIA_CONTRACT_ADDRESS;

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, '../contracts/LuckyMilitiaStats.sol'),
  'utf8'
);

const COMPILER_VERSION = 'v0.8.28+commit.7893614a';
const CONTRACT_NAME    = 'LuckyMilitiaStats';
const RUNS             = 200;

async function verify(apiUrl, apiKey, contractAddress, chainName) {
  if (!apiKey) {
    console.log(`⚠️  Skipping ${chainName} — no API key set (${chainName === 'Base' ? 'BASESCAN_API_KEY' : 'CELOSCAN_API_KEY'})`);
    return;
  }
  if (!contractAddress) {
    console.log(`⚠️  Skipping ${chainName} — no contract address set`);
    return;
  }

  console.log(`\n🔍 Submitting ${chainName} verification for ${contractAddress}...`);

  const params = new URLSearchParams({
    apikey:              apiKey,
    module:              'contract',
    action:              'verifysourcecode',
    contractaddress:     contractAddress,
    sourceCode:          SOURCE,
    codeformat:          'solidity-single-file',
    contractname:        CONTRACT_NAME,
    compilerversion:     COMPILER_VERSION,
    optimizationUsed:    '1',
    runs:                String(RUNS),
    evmversion:          'cancun',
    licenseType:         '3', // MIT
  });

  const res  = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Non-JSON response: ' + text.slice(0, 200)); }

  if (data.status === '1') {
    const guid = data.result;
    console.log(`  ✅ Submitted! GUID: ${guid}`);
    console.log(`  ⏳ Checking status...`);
    await pollStatus(apiUrl, apiKey, guid, chainName);
  } else {
    // Already verified is a success
    if (data.result?.includes('Already Verified') || data.result?.includes('already verified')) {
      console.log(`  ✅ Already verified on ${chainName}`);
    } else {
      console.error(`  ❌ Submission failed: ${data.message} — ${data.result}`);
    }
  }
}

async function pollStatus(apiUrl, apiKey, guid, chainName) {
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 5000));

    const params = new URLSearchParams({
      apikey: apiKey,
      module: 'contract',
      action: 'checkverifystatus',
      guid,
    });

    const res  = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();

    if (data.result === 'Pass - Verified') {
      console.log(`  ✅ ${chainName} contract VERIFIED!`);
      const explorer = chainName === 'Base'
        ? `https://basescan.org/address/${BASE_ADDR}#code`
        : `https://celoscan.io/address/${CELO_ADDR}#code`;
      console.log(`  🔗 ${explorer}`);
      return;
    } else if (data.result?.includes('Pending')) {
      process.stdout.write('.');
    } else if (data.result?.includes('Already Verified')) {
      console.log(`\n  ✅ Already verified on ${chainName}`);
      return;
    } else {
      console.error(`\n  ❌ Verification failed: ${data.result}`);
      return;
    }
  }
  console.log('\n  ⏰ Timed out waiting — check the explorer manually');
}

async function main() {
  console.log('🛡️  LuckyMilitiaStats Contract Verifier');
  console.log(`   Compiler : ${COMPILER_VERSION}`);
  console.log(`   Optimizer: ${RUNS} runs`);

  await verify(
    'https://api.etherscan.io/v2/api?chainid=8453',
    BASESCAN_API,
    BASE_ADDR,
    'Base'
  );

  await verify(
    'https://api.etherscan.io/v2/api?chainid=42220',
    CELOSCAN_API,
    CELO_ADDR,
    'Celo'
  );
}

main().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
