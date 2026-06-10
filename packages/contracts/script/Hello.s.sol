// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "forge-std/Script.sol";
contract Hello is Script {
    function run() external {
        console.log("Hello from Forge!");
    }
}
