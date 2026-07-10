const fs = require('fs');
const path = require('path');
const solc = require('solc');

const contractPath = path.resolve(__dirname, '../contracts/LuckyMilitiaStats.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
    language: 'Solidity',
    sources: {
        'LuckyMilitiaStats.sol': {
            content: source
        }
    },
    settings: {
        optimizer: {
            enabled: true,
            runs: 200
        },
        evmVersion: 'cancun',
        outputSelection: {
            '*': {
                '*': ['*']
            }
        }
    }
};

console.log('Compiling LuckyMilitiaStats.sol...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
    output.errors.forEach(err => {
        console.error(err.formattedMessage);
    });
}

const contract = output.contracts['LuckyMilitiaStats.sol']['LuckyMilitiaStats'];

if (contract) {
    const abi = contract.abi;
    const bytecode = contract.evm.bytecode.object;

    fs.mkdirSync(path.resolve(__dirname, '../artifacts'), { recursive: true });
    fs.writeFileSync(
        path.resolve(__dirname, '../artifacts/LuckyMilitiaStats.json'),
        JSON.stringify({ abi, bytecode }, null, 2)
    );
    console.log('Compilation successful. Artifact saved to artifacts/LuckyMilitiaStats.json');
} else {
    console.error('Compilation failed.');
}
