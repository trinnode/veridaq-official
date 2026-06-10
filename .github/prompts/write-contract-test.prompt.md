---
mode: agent
description: Write a Foundry test for a smart contract function
---

# Write a Foundry test

Use this prompt when you need to add tests to an existing contract or write
a full test file for a new contract.

## Structure

Every test file follows this pattern exactly:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import "../src/ContractName.sol";

contract ContractNameTest is Test {
    ContractName internal target;
    address internal owner  = makeAddr("owner");
    address internal user   = makeAddr("user");
    address internal nobody = makeAddr("nobody");

    function setUp() public {
        vm.startPrank(owner);
        target = new ContractName(/* constructor args if any */);
        vm.stopPrank();
    }

    // Happy path
    function test_descriptiveName_happyPath() public {
        // Arrange
        vm.prank(user);

        // Act
        // target.someFunction(args);

        // Assert
        // assertEq(actual, expected);
    }

    // Reverts
    function test_descriptiveName_revertsWhen_conditionName() public {
        vm.expectRevert(ContractName.ErrorName.selector);
        vm.prank(nobody);
        // target.restrictedFunction();
    }

    // Fuzz
    function testFuzz_descriptiveName(uint256 value) public {
        vm.assume(value > 0 && value < type(uint128).max);
        // ...
    }

    // Events
    function test_descriptiveName_emitsEvent() public {
        vm.expectEmit(true, true, false, true, address(target));
        emit ContractName.EventName(arg1, arg2);
        // target.triggeringFunction();
    }
}
```

## Naming rules

- Test functions use snake_case: `test_registerInstitution_happyPath`
- Revert tests include `revertsWhen`: `test_register_revertsWhen_notOwner`
- Fuzz tests start with `testFuzz_`: `testFuzz_commitment_anyValue`

## What to test for every public function

1. Happy path with valid inputs
2. Every custom revert condition
3. Every event emission
4. Access control (call from wrong role should revert)
5. A fuzz test on any numeric input

## Running

```bash
cd packages/contracts
forge test -vvv --match-test test_ContractNameTest
forge coverage --match-contract ContractNameTest
```
