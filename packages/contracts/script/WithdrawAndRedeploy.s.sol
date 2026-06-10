// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/PaymasterVault.sol";
import "../src/SubscriptionManager.sol";
import "../src/InstitutionRegistry.sol";
import "../src/CredentialRegistry.sol";
import "../src/RevocationRegistry.sol";
import {IEntryPoint} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";

contract WithdrawAndRedeployScript is Script {
  // ── Deployed contract addresses ──────────────────────────────────────────
  address constant OLD_PAYMASTER_ADDRESS = 0xafb5C4610e418b94562D3B294dAa7aFE6AEEb05f;
  address constant SUBSCRIPTION_MANAGER_ADDRESS = 0x1227A5cfFc9acE8438B7835322910288c3D07318;
  address constant ENTRY_POINT_ADDRESS = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
  address constant PLATFORM_ADMIN_ADDRESS = 0x199674cd60606A67E0Fa9fa28Ef00F58A33d2075;

  function run() external {
    uint256 deployerPrivateKey = vm.envUint("PLATFORM_ADMIN_PRIVATE_KEY");

    vm.startBroadcast(deployerPrivateKey);

    console.log("=== Withdrawing from Old PaymasterVault ===");
    console.log("Old Paymaster Address:", OLD_PAYMASTER_ADDRESS);
    console.log("Admin Address:", PLATFORM_ADMIN_ADDRESS);

    // Step 1: Withdraw all funds from the old paymaster
    PaymasterVault oldPaymaster = PaymasterVault(payable(OLD_PAYMASTER_ADDRESS));

    uint256 balanceBefore = PLATFORM_ADMIN_ADDRESS.balance;
    console.log("Admin balance before withdrawal:", balanceBefore);

    try oldPaymaster.emergencyWithdrawSponsoredPool(payable(PLATFORM_ADMIN_ADDRESS)) {
      console.log("[OK] Withdrawal successful");
    } catch Error(string memory reason) {
      console.log("[FAILED] Withdrawal failed with error:", reason);
      console.log(
        "Note: If old contract doesn't have emergencyWithdrawSponsoredPool, funds remain in contract"
      );
    }
    vm.stopBroadcast();

    // Step 2: Check results
    uint256 balanceAfter = PLATFORM_ADMIN_ADDRESS.balance;
    console.log("Admin balance after withdrawal:", balanceAfter);
    console.log("Funds transferred:", balanceAfter - balanceBefore);
  }
}
