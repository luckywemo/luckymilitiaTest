
import { createPublicClient, http, getContract } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const network = process.env.VITE_NETWORK === 'base' ? base : baseSepolia;
const rawClient = createPublicClient({
    chain: network,
    transport: http()
});
const client = rawClient as unknown as { readContract: (p: unknown) => Promise<unknown> };

const ownableAbi = [
    { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }
] as const;

async function check() {
    const address = process.env.VITE_REWARDS_ADDRESS;
    if (!address) {
        console.error('No rewards address found in .env');
        return;
    }

    console.log(`Checking owner for ${address} on ${network.name}...`);
    try {
        const owner = await client.readContract({
            address: address as `0x${string}`,
            abi: ownableAbi,
            functionName: 'owner'
        });
        console.log(`Current owner: ${owner}`);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Error checking owner: ${msg}`);
    }
}

check();
