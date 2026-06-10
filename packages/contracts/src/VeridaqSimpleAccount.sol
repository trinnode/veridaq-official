// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {BaseAccount} from "account-abstraction/contracts/core/BaseAccount.sol";
import {IEntryPoint} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {UserOperation} from "account-abstraction/contracts/interfaces/UserOperation.sol";

/// @title VeridaqSimpleAccount
/// @notice Minimal account for EntryPoint user operations.
contract VeridaqSimpleAccount is BaseAccount, UUPSUpgradeable, Initializable {
  address public owner;

  IEntryPoint private immutable entryPointAddress;

  event SimpleAccountInitialized(IEntryPoint indexed entryPoint, address indexed owner);

  error NotOwner(address msgSender, address account, address owner);
  error NotOwnerOrEntryPoint(address msgSender, address account, address entryPoint, address owner);
  error WrongArrayLength();

  modifier onlyOwner() {
    _onlyOwner();
    _;
  }

  /// @inheritdoc BaseAccount
  function entryPoint() public view override returns (IEntryPoint) {
    return entryPointAddress;
  }

  receive() external payable {}

  /// @notice Create the account implementation with the EntryPoint used for validation.
  constructor(IEntryPoint entryPoint_) {
    entryPointAddress = entryPoint_;
    _disableInitializers();
  }

  /// @notice Initialize the account with its owner.
  function initialize(address owner_) public initializer {
    _initialize(owner_);
  }

  function _initialize(address owner_) internal {
    owner = owner_;
    emit SimpleAccountInitialized(entryPoint(), owner_);
  }

  /// @notice Execute a call to a target address.
  function execute(address dest, uint256 value, bytes calldata func) external {
    _requireFromEntryPointOrOwner();
    _call(dest, value, func);
  }

  /// @notice Execute multiple calls in a single operation.
  function executeBatch(address[] calldata dest, bytes[] calldata func) external {
    _requireFromEntryPointOrOwner();
    if (dest.length != func.length) revert WrongArrayLength();
    for (uint256 i = 0; i < dest.length; i += 1) {
      _call(dest[i], 0, func[i]);
    }
  }

  /// @notice Return the current EntryPoint deposit for this account.
  function getDeposit() public view returns (uint256) {
    return entryPoint().balanceOf(address(this));
  }

  /// @notice Add ETH to the EntryPoint deposit for this account.
  function addDeposit() public payable {
    entryPoint().depositTo{value: msg.value}(address(this));
  }

  /// @notice Withdraw ETH from the EntryPoint deposit.
  function withdrawDepositTo(address payable withdrawAddress, uint256 amount) public onlyOwner {
    entryPoint().withdrawTo(withdrawAddress, amount);
  }

  function _onlyOwner() internal view {
    if (msg.sender != owner && msg.sender != address(this)) {
      revert NotOwner(msg.sender, address(this), owner);
    }
  }

  function _requireFromEntryPointOrOwner() internal view {
    if (msg.sender != address(entryPoint()) && msg.sender != owner) {
      revert NotOwnerOrEntryPoint(msg.sender, address(this), address(entryPoint()), owner);
    }
  }

  function _validateSignature(
    UserOperation calldata userOp,
    bytes32 userOpHash
  ) internal override returns (uint256 validationData) {
    bytes32 digest = MessageHashUtils.toEthSignedMessageHash(userOpHash);
    if (owner != ECDSA.recover(digest, userOp.signature)) {
      return SIG_VALIDATION_FAILED;
    }
    return 0;
  }

  function _authorizeUpgrade(address newImplementation) internal view override {
    (newImplementation);
    _onlyOwner();
  }

  function _call(address target, uint256 value, bytes memory data) internal {
    (bool success, bytes memory result) = target.call{value: value}(data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    }
  }
}
