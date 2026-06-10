---
mode: agent
description: Add a new Solidity smart contract to the contracts package
---

I need a new Solidity contract for VERIDAQ.

Contract details:

- Name: ${contractName}
- Purpose: ${purpose}
- State variables: ${stateVars}
- Events to emit: ${events}
- Access control requirements: ${accessControl}
- Key functions: ${functions}

Please generate:

1. The contract at packages/contracts/src/${contractName}.sol.
   Use Solidity 0.8.28, OpenZeppelin 5 imports, custom errors, NatSpec comments,
   checks-effects-interactions pattern, and proper events on all state changes.
2. A comprehensive Foundry test file at packages/contracts/test/${contractName}.t.sol.
   Cover happy paths, revert cases, and fuzz tests where applicable.
3. Update packages/contracts/script/Deploy.s.sol to include the new contract.

Follow the Solidity conventions in .github/copilot-instructions.md exactly.
