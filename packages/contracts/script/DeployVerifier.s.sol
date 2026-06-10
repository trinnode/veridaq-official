// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Script, console} from "forge-std/Script.sol";
import {Groth16Verifier} from "../src/ZKVerifier.sol";
contract DeployVerifier is Script {
    function run() external {
        uint256 pk = vm.envUint("PLATFORM_ADMIN_PRIVATE_KEY");
        vm.startBroadcast(pk);
        Groth16Verifier verifier = new Groth16Verifier();
        console.log("ZK_VERIFIER_ADDRESS=", address(verifier));
        vm.stopBroadcast();
    }
}
