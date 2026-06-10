---
mode: agent
description: Security review of a specific file or function
---

Please perform a security review of the following code.

Check for:

1. Input validation gaps (missing Zod, unchecked user inputs).
2. Authentication and authorization issues (missing auth checks, role escalation).
3. SQL injection risks (raw queries without parameterization).
4. Sensitive data exposure (private keys, passwords, proofs in logs or responses).
5. Reentrancy risks in Solidity (if reviewing a contract).
6. Integer overflow or underflow in Solidity.
7. Access control issues in smart contracts.
8. Rate limiting on endpoints that modify state.
9. Missing error handling that could crash the server.
10. Any secret stored in code rather than environment variables.

For each finding, state: severity (Critical / High / Medium / Low), description of
the issue, and a concrete fix.

Code to review:
${code}
