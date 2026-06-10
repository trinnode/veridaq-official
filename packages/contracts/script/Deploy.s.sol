// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {InstitutionRegistry} from "../src/InstitutionRegistry.sol";
import {CredentialRegistry} from "../src/CredentialRegistry.sol";
import {RevocationRegistry} from "../src/RevocationRegistry.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {PaymasterVault} from "../src/PaymasterVault.sol";

/// @notice Deploys VERIDAQ core contracts
contract Deploy is Script {
  function run() external {
    address admin = vm.envAddress("PLATFORM_ADMIN_ADDRESS");
    uint256 pk = vm.envUint("PLATFORM_ADMIN_PRIVATE_KEY");
    address entryPoint = vm.envAddress("ENTRY_POINT_ADDRESS");

    vm.startBroadcast(pk);

    // 1. Deploy InstitutionRegistry
    InstitutionRegistry instRegistry = new InstitutionRegistry(admin);
    console.log("InstitutionRegistry:", address(instRegistry));

    // 2. Deploy CredentialRegistry (depends on InstitutionRegistry)
    CredentialRegistry credRegistry = new CredentialRegistry(admin, address(instRegistry));
    console.log("CredentialRegistry:", address(credRegistry));

    // 3. Deploy RevocationRegistry (depends on both registries)
    RevocationRegistry revoRegistry = new RevocationRegistry(
      admin,
      address(instRegistry),
      address(credRegistry)
    );
    console.log("RevocationRegistry:", address(revoRegistry));

    // 4. Deploy SubscriptionManager
    SubscriptionManager subManager = new SubscriptionManager(admin);
    subManager.grantRole(subManager.BUNDLER_ROLE(), admin);
    console.log("SubscriptionManager:", address(subManager));

    // 5. Deploy PaymasterVault
    PaymasterVault paymaster = new PaymasterVault(entryPoint, address(subManager), admin);
    console.log("PaymasterVault:", address(paymaster));

    vm.stopBroadcast();

    // Print a summary for easy .env filling
    console.log("\n=== Copy these to your .env file ===");
    console.log("INSTITUTION_REGISTRY_ADDRESS=", address(instRegistry));
    console.log("CREDENTIAL_REGISTRY_ADDRESS=", address(credRegistry));
    console.log("REVOCATION_REGISTRY_ADDRESS=", address(revoRegistry));
    console.log("SUBSCRIPTION_MANAGER_ADDRESS=", address(subManager));
    console.log("PAYMASTER_VAULT_ADDRESS=", address(paymaster));
  }
}
