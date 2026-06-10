// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import "forge-std/console2.sol";
import {CredentialRegistry} from "../src/CredentialRegistry.sol";
import {InstitutionRegistry} from "../src/InstitutionRegistry.sol";

contract CredentialRegistryTest is Test {
  CredentialRegistry credReg;
  InstitutionRegistry instReg;

  address admin = makeAddr("admin");
  address institutionAdmin = makeAddr("institutionAdmin");
  address alice = makeAddr("alice");

  bytes32 constant INST_ID = keccak256("futminna");
  bytes constant PUBLIC_KEY = hex"04aabbcc";

  function setUp() public {
    // Deploy InstitutionRegistry first
    instReg = new InstitutionRegistry(admin);

    // Deploy CredentialRegistry
    credReg = new CredentialRegistry(admin, address(instReg));

    // Register an institution
    vm.prank(admin);
    instReg.registerInstitution(
      INST_ID,
      "Federal University of Technology Minna",
      institutionAdmin,
      PUBLIC_KEY
    );
  }

  // ── Basic Functionality Tests ─────────────────────────────────────────────

  function test_register_single_batch() public {
    bytes32[] memory commitments = new bytes32[](1);
    bytes32[] memory nullifiers = new bytes32[](1);

    commitments[0] = keccak256("commitment1");
    nullifiers[0] = keccak256("nullifier1");

    vm.prank(institutionAdmin);
    credReg.registerBatch(INST_ID, commitments, nullifiers, 2024, 1, keccak256("batch1"));

    assertTrue(credReg.exists(nullifiers[0]));
    assertEq(credReg.getCommitment(nullifiers[0]), commitments[0]);
  }

  function test_register_batch_reverts_empty() public {
    bytes32[] memory empty = new bytes32[](0);

    vm.prank(institutionAdmin);
    vm.expectRevert(CredentialRegistry.EmptyBatch.selector);
    credReg.registerBatch(INST_ID, empty, empty, 2024, 1, keccak256("batch1"));
  }

  function test_register_batch_reverts_length_mismatch() public {
    bytes32[] memory commitments = new bytes32[](2);
    bytes32[] memory nullifiers = new bytes32[](1);

    vm.prank(institutionAdmin);
    vm.expectRevert(CredentialRegistry.ArrayLengthMismatch.selector);
    credReg.registerBatch(INST_ID, commitments, nullifiers, 2024, 1, keccak256("batch1"));
  }

  function test_register_batch_reverts_duplicate_nullifier() public {
    bytes32[] memory commitments = new bytes32[](1);
    bytes32[] memory nullifiers = new bytes32[](1);

    commitments[0] = keccak256("commitment1");
    nullifiers[0] = keccak256("nullifier1");

    vm.startPrank(institutionAdmin);
    credReg.registerBatch(INST_ID, commitments, nullifiers, 2024, 1, keccak256("batch1"));

    vm.expectRevert(
      abi.encodeWithSelector(CredentialRegistry.AlreadyRegistered.selector, nullifiers[0])
    );
    credReg.registerBatch(INST_ID, commitments, nullifiers, 2024, 1, keccak256("batch2"));
    vm.stopPrank();
  }

  function test_register_batch_reverts_wrong_caller() public {
    bytes32[] memory commitments = new bytes32[](1);
    bytes32[] memory nullifiers = new bytes32[](1);

    commitments[0] = keccak256("commitment1");
    nullifiers[0] = keccak256("nullifier1");

    vm.prank(alice);
    vm.expectRevert(
      abi.encodeWithSelector(CredentialRegistry.CallerNotInstitutionAdmin.selector, INST_ID, alice)
    );
    credReg.registerBatch(INST_ID, commitments, nullifiers, 2024, 1, keccak256("batch1"));
  }

  function test_register_batch_allows_bundler_role() public {
    bytes32[] memory commitments = new bytes32[](1);
    bytes32[] memory nullifiers = new bytes32[](1);

    commitments[0] = keccak256("commitment1");
    nullifiers[0] = keccak256("nullifier1");

    // admin has BUNDLER_ROLE (granted in constructor) but is not the institution admin wallet
    assertTrue(credReg.hasRole(credReg.BUNDLER_ROLE(), admin));
    assertTrue(instReg.getAdminWallet(INST_ID) != admin);

    vm.prank(admin);
    credReg.registerBatch(INST_ID, commitments, nullifiers, 2024, 1, keccak256("bundler-batch"));

    assertTrue(credReg.exists(nullifiers[0]));
  }

  function test_register_batch_reverts_inactive_institution() public {
    vm.prank(admin);
    instReg.deactivateInstitution(INST_ID);

    bytes32[] memory commitments = new bytes32[](1);
    bytes32[] memory nullifiers = new bytes32[](1);

    commitments[0] = keccak256("commitment1");
    nullifiers[0] = keccak256("nullifier1");

    vm.prank(institutionAdmin);
    vm.expectRevert(
      abi.encodeWithSelector(CredentialRegistry.InstitutionNotActive.selector, INST_ID)
    );
    credReg.registerBatch(INST_ID, commitments, nullifiers, 2024, 1, keccak256("batch1"));
  }

  // ── Gas Cost Tests for Batch Registration ─────────────────────────────────

  /// @notice Measures gas cost for registering a batch of 1 credential
  function test_gas_batch_size_1() public {
    (bytes32[] memory commitments, bytes32[] memory nullifiers) = _generateBatch(1);

    uint256 gasBefore = gasleft();
    vm.prank(institutionAdmin);
    credReg.registerBatch(INST_ID, commitments, nullifiers, 2024, 1, keccak256("batch1"));
    uint256 gasUsed = gasBefore - gasleft();

    console.log("Gas used for batch size 1:", gasUsed);
    console.log("Gas per credential:", gasUsed);
  }

  /// @notice Measures gas cost for registering a batch of 10 credentials
  function test_gas_batch_size_10() public {
    (bytes32[] memory commitments, bytes32[] memory nullifiers) = _generateBatch(10);

    uint256 gasBefore = gasleft();
    vm.prank(institutionAdmin);
    credReg.registerBatch(INST_ID, commitments, nullifiers, 2024, 1, keccak256("batch10"));
    uint256 gasUsed = gasBefore - gasleft();

    console.log("Gas used for batch size 10:", gasUsed);
    console.log("Gas per credential:", gasUsed / 10);
  }

  /// @notice Measures gas cost for registering a batch of 50 credentials
  function test_gas_batch_size_50() public {
    (bytes32[] memory commitments, bytes32[] memory nullifiers) = _generateBatch(50);

    uint256 gasBefore = gasleft();
    vm.prank(institutionAdmin);
    credReg.registerBatch(INST_ID, commitments, nullifiers, 2024, 1, keccak256("batch50"));
    uint256 gasUsed = gasBefore - gasleft();

    console.log("Gas used for batch size 50:", gasUsed);
    console.log("Gas per credential:", gasUsed / 50);
  }

  /// @notice Measures gas cost for registering a batch of 100 credentials
  function test_gas_batch_size_100() public {
    (bytes32[] memory commitments, bytes32[] memory nullifiers) = _generateBatch(100);

    uint256 gasBefore = gasleft();
    vm.prank(institutionAdmin);
    credReg.registerBatch(INST_ID, commitments, nullifiers, 2024, 1, keccak256("batch100"));
    uint256 gasUsed = gasBefore - gasleft();

    console.log("Gas used for batch size 100:", gasUsed);
    console.log("Gas per credential:", gasUsed / 100);
  }

  /// @notice Comprehensive gas analysis across different batch sizes
  function test_gas_batch_scaling_analysis() public {
    uint256[] memory sizes = new uint256[](6);
    sizes[0] = 1;
    sizes[1] = 5;
    sizes[2] = 10;
    sizes[3] = 25;
    sizes[4] = 50;
    sizes[5] = 100;
    uint256 offset = 0;

    console.log("\n=== Batch Registration Gas Cost Analysis ===");
    console.log("Batch Size | Total Gas | Gas/Credential | Overhead");
    console.log("--------------------------------------------------------");

    for (uint256 i = 0; i < sizes.length; i++) {
      uint256 size = sizes[i];
      (bytes32[] memory commitments, bytes32[] memory nullifiers) = _generateBatch(size, offset);
      offset += size;

      uint256 gasBefore = gasleft();
      vm.prank(institutionAdmin);
      credReg.registerBatch(
        INST_ID,
        commitments,
        nullifiers,
        2024,
        1,
        keccak256(abi.encodePacked("batch", i))
      );
      uint256 gasUsed = gasBefore - gasleft();

      uint256 gasPerCred = gasUsed / size;
    }
    console.log("========================================================\n");
  }

  // ── Time Measurement Tests ────────────────────────────────────────────────

  /// @notice Measures time for batch registration
  function test_time_batch_registration() public {
    (bytes32[] memory commitments, bytes32[] memory nullifiers) = _generateBatch(50);

    uint256 startTime = block.timestamp;

    vm.prank(institutionAdmin);
    credReg.registerBatch(INST_ID, commitments, nullifiers, 2024, 1, keccak256("batch50"));

    vm.warp(block.timestamp + 1);
    uint256 endTime = block.timestamp;

    console.log("Time for 50 credential batch (blocks):", endTime - startTime);

    // Verify the first record has correct timestamp
    CredentialRegistry.CredentialRecord memory record = credReg.getRecord(nullifiers[0]);
    assertEq(record.registeredAt, startTime);
  }

  /// @notice Measures time for sequential batch registrations
  function test_time_sequential_batches() public {
    uint256 batchCount = 5;
    uint256 batchSize = 20;

    uint256 startTime = block.timestamp;

    vm.startPrank(institutionAdmin);
    for (uint256 i = 0; i < batchCount; i++) {
      (bytes32[] memory commitments, bytes32[] memory nullifiers) = _generateBatch(
        batchSize,
        i * batchSize // offset to avoid duplicates
      );

      credReg.registerBatch(
        INST_ID,
        commitments,
        nullifiers,
        2024,
        1,
        keccak256(abi.encodePacked("batch", i))
      );

      vm.warp(block.timestamp + 1);
    }
    vm.stopPrank();

    uint256 endTime = block.timestamp;
    uint256 totalTime = endTime - startTime;

    console.log("Total time for", batchCount, "batches (blocks):", totalTime);
    console.log("Average time per batch (blocks):", totalTime / batchCount);
    console.log("Total credentials registered:", batchCount * batchSize);
  }

  // ── Gas Snapshot Tests ────────────────────────────────────────────────────

  /// @notice Creates gas snapshot for small batch
  function test_snapshot_batch_10() public {
    (bytes32[] memory commitments, bytes32[] memory nullifiers) = _generateBatch(10);

    vm.prank(institutionAdmin);
    credReg.registerBatch(INST_ID, commitments, nullifiers, 2024, 1, keccak256("batch10"));
  }

  /// @notice Creates gas snapshot for medium batch
  function test_snapshot_batch_50() public {
    (bytes32[] memory commitments, bytes32[] memory nullifiers) = _generateBatch(50);

    vm.prank(institutionAdmin);
    credReg.registerBatch(INST_ID, commitments, nullifiers, 2024, 1, keccak256("batch50"));
  }

  /// @notice Creates gas snapshot for large batch
  function test_snapshot_batch_100() public {
    (bytes32[] memory commitments, bytes32[] memory nullifiers) = _generateBatch(100);

    vm.prank(institutionAdmin);
    credReg.registerBatch(INST_ID, commitments, nullifiers, 2024, 1, keccak256("batch100"));
  }

  // ── Fuzz Tests ────────────────────────────────────────────────────────────

  /// @notice Fuzz test for various batch sizes
  function testFuzz_batch_registration(uint8 size) public {
    vm.assume(size > 0 && size <= 100); // Reasonable batch size limits

    (bytes32[] memory commitments, bytes32[] memory nullifiers) = _generateBatch(size);

    vm.prank(institutionAdmin);
    credReg.registerBatch(INST_ID, commitments, nullifiers, 2024, 1, keccak256("fuzzBatch"));

    // Verify all records exist
    for (uint256 i = 0; i < size; i++) {
      assertTrue(credReg.exists(nullifiers[i]));
    }
  }

  // ── Helper Functions ──────────────────────────────────────────────────────

  /// @notice Generates a batch of unique commitments and nullifiers
  /// @param size Number of credentials to generate
  /// @return commitments Array of commitment hashes
  /// @return nullifiers Array of nullifier hashes
  function _generateBatch(
    uint256 size
  ) internal pure returns (bytes32[] memory commitments, bytes32[] memory nullifiers) {
    return _generateBatch(size, 0);
  }

  /// @notice Generates a batch with an offset for uniqueness across multiple calls
  /// @param size Number of credentials to generate
  /// @param offset Starting index offset
  /// @return commitments Array of commitment hashes
  /// @return nullifiers Array of nullifier hashes
  function _generateBatch(
    uint256 size,
    uint256 offset
  ) internal pure returns (bytes32[] memory commitments, bytes32[] memory nullifiers) {
    commitments = new bytes32[](size);
    nullifiers = new bytes32[](size);

    for (uint256 i = 0; i < size; i++) {
      uint256 index = offset + i;
      commitments[i] = keccak256(abi.encodePacked("commitment", index));
      nullifiers[i] = keccak256(abi.encodePacked("nullifier", index));
    }

    return (commitments, nullifiers);
  }
}
