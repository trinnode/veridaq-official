// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IEntryPoint} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {VeridaqSimpleAccount} from "./VeridaqSimpleAccount.sol";

/// @title VeridaqSimpleAccountFactory
/// @notice Deploys SimpleAccount instances with deterministic addresses.
contract VeridaqSimpleAccountFactory {
  VeridaqSimpleAccount public immutable accountImplementation;

  event AccountCreated(address indexed account, address indexed owner, uint256 salt);

  error ZeroOwner();
  error InvalidEntryPoint();

  /// @notice Create the factory with the EntryPoint that validates user operations.
  /// @param entryPointAddress The EntryPoint address for this chain.
  constructor(address entryPointAddress) {
    if (entryPointAddress == address(0)) revert InvalidEntryPoint();
    accountImplementation = new VeridaqSimpleAccount(IEntryPoint(entryPointAddress));
  }

  /// @notice Create an account or return it if already deployed.
  /// @param owner The EOA that controls the SimpleAccount.
  /// @param salt The Create2 salt used for deterministic address creation.
  function createAccount(address owner, uint256 salt) external returns (VeridaqSimpleAccount ret) {
    if (owner == address(0)) revert ZeroOwner();
    address addr = getAddress(owner, salt);
    if (addr.code.length > 0) {
      return VeridaqSimpleAccount(payable(addr));
    }
    ret = VeridaqSimpleAccount(
      payable(
        new ERC1967Proxy{salt: bytes32(salt)}(
          address(accountImplementation),
          abi.encodeCall(VeridaqSimpleAccount.initialize, (owner))
        )
      )
    );
    emit AccountCreated(address(ret), owner, salt);
  }

  /// @notice Compute the counterfactual address for an account.
  /// @param owner The EOA that controls the SimpleAccount.
  /// @param salt The Create2 salt used for deterministic address creation.
  function getAddress(address owner, uint256 salt) public view returns (address) {
    if (owner == address(0)) revert ZeroOwner();
    return
      Create2.computeAddress(
        bytes32(salt),
        keccak256(
          abi.encodePacked(
            type(ERC1967Proxy).creationCode,
            abi.encode(
              address(accountImplementation),
              abi.encodeCall(VeridaqSimpleAccount.initialize, (owner))
            )
          )
        )
      );
  }
}
