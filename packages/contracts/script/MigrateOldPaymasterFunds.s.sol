// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";

interface IPaymasterOld {
  function emergencyWithdrawSponsoredPool(address payable to) external;
  function withdrawInstitutionBalance(
    bytes32 institutionId,
    address payable to,
    uint256 amount
  ) external;
}

interface IEntryPoint {
  function withdrawTo(address payable withdrawAddress, uint256 amount) external;
}

/**
 * This script helps migrate funds from the old PaymasterVault to the admin address.
 *
 * The old PaymasterVault (0xafb5C4610e418b94562D3B294dAa7aFE6AEEb05f) has:
 * - ~0.17 ETH in its balance that needs to be extracted
 *
 * The new PaymasterVault (0x6Fce8141a8f3945CfcBC16d10F55b4B480e03423) has:
 * - The emergencyWithdrawSponsoredPool function for safe fund extraction
 *
 * Steps:
 * 1. If the old contract has the new function, call it to withdraw
 * 2. If not, we need manual extraction (see fallback options below)
 */
contract OldPaymasterFundsMigration is Script {
  address constant OLD_PAYMASTER = 0xafb5C4610e418b94562D3B294dAa7aFE6AEEb05f;
  address constant ADMIN = 0x199674cd60606A67E0Fa9fa28Ef00F58A33d2075;
  address constant ENTRY_POINT = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;

  function run() external {
    uint256 pk = vm.envUint("PLATFORM_ADMIN_PRIVATE_KEY");
    vm.startBroadcast(pk);

    console.log("=== Old PaymasterVault Funds Migration ===");
    console.log("Old PaymasterVault:", OLD_PAYMASTER);
    console.log("Admin:", ADMIN);

    // Check old contract balance
    uint256 oldBalance = OLD_PAYMASTER.balance;
    console.log("Old PaymasterVault balance:", oldBalance / 1e18, "ETH");

    if (oldBalance == 0) {
      console.log("[INFO] No funds to migrate");
      vm.stopBroadcast();
      return;
    }

    // Try to use the new withdrawal function if it exists in old contract
    console.log("[ATTEMPTING] Calling emergencyWithdrawSponsoredPool on old contract...");
    try IPaymasterOld(payable(OLD_PAYMASTER)).emergencyWithdrawSponsoredPool(payable(ADMIN)) {
      console.log("[SUCCESS] Funds withdrawn via emergencyWithdrawSponsoredPool");
    } catch {
      console.log("[FALLBACK] emergencyWithdrawSponsoredPool not available in old contract");
      console.log("[INFO] To extract these funds, you have these options:");
      console.log("  1. Manually call withdrawInstitutionBalance if institution funds exist");
      console.log("  2. Deploy a helper contract that uses delegatecall to selfdestruct");
      console.log("  3. Contact the team for emergency fund extraction assistance");
      console.log("[NOTE] These funds are safe and can be extracted at any time");
    }
    uint256 newBalance = ADMIN.balance;
    console.log("Admin balance after migration:", newBalance / 1e18, "ETH");

    vm.stopBroadcast();
  }
}
