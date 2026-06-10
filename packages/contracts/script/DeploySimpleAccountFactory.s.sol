// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {VeridaqSimpleAccountFactory} from "../src/VeridaqSimpleAccountFactory.sol";

/// @notice Deploys the SimpleAccount factory for ERC 4337 flows.
contract DeploySimpleAccountFactory is Script {
  function run() external {
    uint256 pk = vm.envUint("PLATFORM_ADMIN_PRIVATE_KEY");
    address entryPoint = vm.envAddress("ENTRY_POINT_ADDRESS");

    vm.startBroadcast(pk);
    VeridaqSimpleAccountFactory factory = new VeridaqSimpleAccountFactory(entryPoint);
    console.log("VeridaqSimpleAccountFactory:", address(factory));
    vm.stopBroadcast();

    console.log("\n=== Copy this to your .env file ===");
    console.log("AA_SIMPLE_ACCOUNT_FACTORY_ADDRESS=", address(factory));
  }
}
