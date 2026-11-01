// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PaymasterVault} from "../src/PaymasterVault.sol";

/// @notice Deploys a replacement PaymasterVault and nothing else.
///
/// @dev Every value comes from the environment. The previous version hardcoded
///      an "old paymaster" address from two deployments ago, which made its
///      migration notes wrong and its output misleading. Migrating funds is a
///      separate, deliberate step — this script only deploys, so that a failed
///      funding transaction can never leave the system without a paymaster.
///
///      Run:
///        forge script script/DeployNewPaymaster.s.sol \
///          --rpc-url base_sepolia --broadcast --verify
contract DeployNewPaymaster is Script {
  function run() external returns (PaymasterVault deployed) {
    address admin = vm.envAddress("PLATFORM_ADMIN_ADDRESS");
    uint256 pk = vm.envUint("PLATFORM_ADMIN_PRIVATE_KEY");
    address entryPoint = vm.envAddress("ENTRY_POINT_ADDRESS");
    address subManagerAddr = vm.envAddress("SUBSCRIPTION_MANAGER_ADDRESS");

    // Optional: the vault currently in use, printed for comparison only.
    address previous = vm.envOr("PAYMASTER_VAULT_ADDRESS", address(0));

    console.log("=== PaymasterVault deployment ===");
    console.log("Admin              :", admin);
    console.log("EntryPoint         :", entryPoint);
    console.log("SubscriptionManager:", subManagerAddr);
    if (previous != address(0)) {
      console.log("Currently in .env  :", previous);
    }

    vm.startBroadcast(pk);
    deployed = new PaymasterVault(entryPoint, subManagerAddr, admin);
    vm.stopBroadcast();

    console.log("");
    console.log("New PaymasterVault :", address(deployed));
    console.log("");
    console.log("Next steps, in this order:");
    console.log("  1. Drain the old vault: emergencyWithdrawSponsoredPool(admin)");
    console.log("  2. Fund the new vault:  fundSponsoredPool{value: <drained amount>}()");
    console.log("  3. Set PAYMASTER_VAULT_ADDRESS in .env to the new address");
    console.log("  4. Restart the backend so the bundler path picks it up");
  }
}
