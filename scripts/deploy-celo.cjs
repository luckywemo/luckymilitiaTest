const fs = require('fs');
const path = require('path');
const { createWalletClient, createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { celo } = require('viem/chains');
require('dotenv').config();

async function main() {
    const pk = process.env.EVM_PRIVATE_KEY;
    if (!pk) {
        console.error('Error: EVM_PRIVATE_KEY not found in .env');
        process.exit(1);
    }

    const artifactPath = path.resolve(__dirname, '../artifacts/LuckyMilitiaStats.json');
    if (!fs.existsSync(artifactPath)) {
        console.error('Error: Artifact not found. Run compile first.');
        process.exit(1);
    }

    const { abi, bytecode } = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
    
    // Celo Mainnet RPC: https://forno.celo.org
    const CELO_RPC = 'https://forno.celo.org';

    const client = createWalletClient({
        account,
        chain: celo,
        transport: http(CELO_RPC)
    });

    const publicClient = createPublicClient({
        chain: celo,
        transport: http(CELO_RPC)
    });

    console.log(`Deploying LuckyMilitiaStats to Celo Mainnet (for MiniPay) from ${account.address}...`);

    const hash = await client.deployContract({
        abi,
        bytecode: bytecode.startsWith('0x') ? bytecode : `0x${bytecode}`,
        gas: 1100000n,
    });

    console.log(`Deployment transaction sent: ${hash}`);
    console.log('Waiting for confirmation...');

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    const newAddr = receipt.contractAddress;
    console.log(`✅ Contract deployed at: ${newAddr}`);

    // Authorize relay key
    const relayKey = process.env.EVM_RELAY_KEY || process.env.EVM_PRIVATE_KEY;
    const relayAccount = privateKeyToAccount(relayKey.startsWith('0x') ? relayKey : `0x${relayKey}`);
    if (relayAccount.address.toLowerCase() !== account.address.toLowerCase()) {
        console.log(`\nAuthorizing relay ${relayAccount.address}...`);
        const authHash = await client.writeContract({
            address: newAddr,
            abi,
            functionName: 'setAuthorizedRelayer',
            args: [relayAccount.address, true],
        });
        await publicClient.waitForTransactionReceipt({ hash: authHash });
        console.log(`✅ Relay authorized: ${relayAccount.address}`);
    } else {
        console.log(`\n(Relay key == deployer key — no separate authorization needed)`);
    }

    console.log('\nUPDATE YOUR .env FILE:');
    console.log(`VITE_CELO_MILITIA_CONTRACT_ADDRESS=${newAddr}`);
    console.log(`OLD_CELO_CONTRACT=<previous address here>`);
    console.log('\nMINIPAY COMPLIANCE CHECK:');
    console.log('- Celo Network: Active');
    console.log('- Fee Currency: CELO (default)');
}

main().catch(console.error);
