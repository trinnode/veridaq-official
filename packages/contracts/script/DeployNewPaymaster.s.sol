// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PaymasterVault} from "../src/PaymasterVault.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";

/// @notice Redeploys only the PaymasterVault with the fixed depositTo functionality
contract DeployNewPaymaster is Script {
  function run() external {
    address admin = vm.envAddress("PLATFORM_ADMIN_ADDRESS");
    uint256 pk = vm.envUint("PLATFORM_ADMIN_PRIVATE_KEY");
    address entryPoint = vm.envAddress("ENTRY_POINT_ADDRESS");
    address subManagerAddr = vm.envAddress("SUBSCRIPTION_MANAGER_ADDRESS");

    address oldPaymaster = 0xafb5C4610e418b94562D3B294dAa7aFE6AEEb05f;

    vm.startBroadcast(pk);

    console.log("=== Deploying New PaymasterVault ===");
    console.log("Admin:", admin);
    console.log("EntryPoint:", entryPoint);
    console.log("SubscriptionManager:", subManagerAddr);
    console.log("Old PaymasterVault (funds still there):", oldPaymaster);

    // Deploy the new PaymasterVault with the fixed depositTo logic
    PaymasterVault newPaymaster = new PaymasterVault(entryPoint, subManagerAddr, admin);

    console.log("\n=== New PaymasterVault Deployed ===");
    console.log("New PaymasterVault Address:", address(newPaymaster));

    console.log("\n=== IMPORTANT: Update your .env file with the new address ===");
    console.log("Old address:", oldPaymaster);
    console.log("New address:", address(newPaymaster));
    console.log("Set: PAYMASTER_VAULT_ADDRESS=", address(newPaymaster));

    console.log("\n=== Migration Notes ===");
    console.log("1. The new PaymasterVault is now deployed with the fix");
    console.log("2. It will properly call entryPoint.depositTo() on fundInstitution()");
    console.log("3. Old PaymasterVault still has ~0.17 ETH that can be extracted later");
    console.log("4. Update backend .env and restart services");

    vm.stopBroadcast();
  }
}
