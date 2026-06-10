// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {CredentialRegistry} from "../src/CredentialRegistry.sol";
import {RevocationRegistry} from "../src/RevocationRegistry.sol";

/// @notice Redeploys CredentialRegistry and RevocationRegistry only.
contract RedeployRegistries is Script {
  function run() external {
    address admin = vm.envAddress("PLATFORM_ADMIN_ADDRESS");
    uint256 pk = vm.envUint("PLATFORM_ADMIN_PRIVATE_KEY");
    address instRegistry = vm.envAddress("INSTITUTION_REGISTRY_ADDRESS");

    vm.startBroadcast(pk);

    CredentialRegistry credRegistry = new CredentialRegistry(admin, instRegistry);
    console.log("CredentialRegistry:", address(credRegistry));

    RevocationRegistry revoRegistry = new RevocationRegistry(
      admin,
      instRegistry,
      address(credRegistry)
    );
    console.log("RevocationRegistry:", address(revoRegistry));

    vm.stopBroadcast();

    console.log("\n=== Copy these to your .env files ===");
    console.log("CREDENTIAL_REGISTRY_ADDRESS=", address(credRegistry));
    console.log("REVOCATION_REGISTRY_ADDRESS=", address(revoRegistry));
  }
}
