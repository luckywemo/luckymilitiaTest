
import { createPublicClient, http } from 'viem';
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

const addresses = [
    '0x6798af2F4d4520D42793148Cd9B2d6701543a89F',
    '0xBE15A34098C82d99Ed3CE855b41d1145c26AB17D',
    '0xa682EEB87e472f9ef6e1aBc36b30dc48e4836fC2',
    '0xC52b7Bf3474a40961c9994512AaE677f700Da494'
];

async function identify() {
    for (const addr of addresses) {
        console.log(`--- Identifying ${addr} ---`);
        try {
            const name = await client.readContract({
                address: addr as `0x${string}`,
                abi: [{ name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }] as const,
                functionName: 'name'
            });
            console.log(`Name: ${name}`);
        } catch (e) { }

        try {
            const owner = await client.readContract({
                address: addr as `0x${string}`,
                abi: [{ name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }] as const,
                functionName: 'owner'
            });
            console.log(`Owner: ${owner}`);
        } catch (e: unknown) { }
    }
}

identify();
