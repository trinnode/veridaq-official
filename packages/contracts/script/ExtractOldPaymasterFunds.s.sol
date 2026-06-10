// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";

interface IOldPaymaster {
  function emergencyWithdrawSponsoredPool(address payable to) external;
}

/**
 * Emergency fund extraction helper.
 * Since the old PaymasterVault doesn't have emergencyWithdrawSponsoredPool,
 * we'll attempt to use delegatecall to extract the funds to the admin address.
 *
 * If the old contract was deployed with the function, this will work.
 * Otherwise, we may need to manually send a transaction to the old contract.
 */
contract ExtractOldPaymasterFunds is Script {
  address constant OLD_PAYMASTER = 0xafb5C4610e418b94562D3B294dAa7aFE6AEEb05f;
  address constant ADMIN = 0x199674cd60606A67E0Fa9fa28Ef00F58A33d2075;

  receive() external payable {}

  function run() external {
    uint256 deployerKey = vm.envUint("PLATFORM_ADMIN_PRIVATE_KEY");
    vm.startBroadcast(deployerKey);

    console.log("=== Attempting to Extract Funds from Old PaymasterVault ===");
    console.log("Old PaymasterVault:", OLD_PAYMASTER);
    console.log("Admin address:", ADMIN);

    uint256 balanceBefore = ADMIN.balance;
    console.log("Admin balance before:", balanceBefore / 1e18, "ETH");

    uint256 pmBalance = OLD_PAYMASTER.balance;
    console.log("Old PaymasterVault balance:", pmBalance / 1e18, "ETH");

    if (pmBalance > 0) {
      // Attempt to call emergencyWithdrawSponsoredPool
      // If this function exists in the old contract, it will withdraw the funds
      try IOldPaymaster(payable(OLD_PAYMASTER)).emergencyWithdrawSponsoredPool(payable(ADMIN)) {
        console.log("[SUCCESS] emergencyWithdrawSponsoredPool executed");
      } catch {
        console.log("[INFO] emergencyWithdrawSponsoredPool not found in old contract");
        console.log("[WARNING] Old paymaster funds remain in contract at:", OLD_PAYMASTER);
        console.log("These funds will need to be manually extracted or migrated");
      }
    }

    uint256 balanceAfter = ADMIN.balance;
    console.log("Admin balance after:", balanceAfter / 1e18, "ETH");
    console.log("Net change:", (balanceAfter - balanceBefore) / 1e18, "ETH");

    vm.stopBroadcast();
  }
}
