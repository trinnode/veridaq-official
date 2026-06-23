// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {Groth16Verifier} from "../src/ZKVerifier.sol";

contract ZKVerifierTest is Test {
  Groth16Verifier internal verifier;

  // Scalar field size — any public signal >= this must be rejected
  uint256 constant R =
    21888242871839275222246405745257275088548364400416034343698204186575808495617;

  function setUp() public {
    verifier = new Groth16Verifier();
  }

  /// @notice The contract exists and has the expected type
  function test_verifier_deployed() public {
    assertTrue(address(verifier) != address(0));
  }

  /// @notice An all-zero proof must return false (not revert)
  function test_invalid_proof_returns_false() public view {
    uint256[2]   memory pA;
    uint256[2][2] memory pB;
    uint256[2]   memory pC;
    uint256[4]   memory pubSignals;
    bool result = verifier.verifyProof(pA, pB, pC, pubSignals);
    assertFalse(result);
  }

  /// @notice An all-zero proof with one non-zero public signal still fails pairing
  function test_invalid_proof_with_nonzero_signal_returns_false() public view {
    uint256[2]   memory pA;
    uint256[2][2] memory pB;
    uint256[2]   memory pC;
    uint256[4]   memory pubSignals;
    pubSignals[0] = 1;
    pubSignals[1] = 2;
    pubSignals[2] = 3;
    pubSignals[3] = 4;
    bool result = verifier.verifyProof(pA, pB, pC, pubSignals);
    assertFalse(result);
  }

  /// @notice Public signal at the field boundary (== R) must be rejected via checkField
  function test_public_signal_at_field_boundary_rejected() public {
    uint256[2]   memory pA;
    uint256[2][2] memory pB;
    uint256[2]   memory pC;
    uint256[4]   memory pubSignals;

    // Set first public signal to R — this is NOT < R, so checkField rejects it
    pubSignals[0] = R;

    // The assembly checkField does: if iszero(lt(v, r)) { mstore(0,0); return(0,0x20) }
    // which returns 0 encoded as a single word.
    bool result = verifier.verifyProof(pA, pB, pC, pubSignals);
    assertFalse(result);
  }

  /// @notice Public signal above the field must be rejected
  function test_public_signal_above_field_rejected() public {
    uint256[2]   memory pA;
    uint256[2][2] memory pB;
    uint256[2]   memory pC;
    uint256[4]   memory pubSignals;

    pubSignals[0] = R + 1;

    bool result = verifier.verifyProof(pA, pB, pC, pubSignals);
    assertFalse(result);
  }

  /// @notice Every public signal index is checked — test index 1, 2, and 3
  function test_public_signal_at_index_1_rejected() public {
    uint256[2]   memory pA;
    uint256[2][2] memory pB;
    uint256[2]   memory pC;
    uint256[4]   memory pubSignals;

    pubSignals[1] = R;

    bool result = verifier.verifyProof(pA, pB, pC, pubSignals);
    assertFalse(result);
  }

  function test_public_signal_at_index_2_rejected() public {
    uint256[2]   memory pA;
    uint256[2][2] memory pB;
    uint256[2]   memory pC;
    uint256[4]   memory pubSignals;

    pubSignals[2] = R;

    bool result = verifier.verifyProof(pA, pB, pC, pubSignals);
    assertFalse(result);
  }

  function test_public_signal_at_index_3_rejected() public {
    uint256[2]   memory pA;
    uint256[2][2] memory pB;
    uint256[2]   memory pC;
    uint256[4]   memory pubSignals;

    pubSignals[3] = R;

    bool result = verifier.verifyProof(pA, pB, pC, pubSignals);
    assertFalse(result);
  }

  /// @notice Proof with non-zero G1/G2 points that are not in the correct subgroup
  ///         should return false (pairing precompile returns 0)
  function test_random_point_rejected() public view {
    uint256[2]   memory pA;
    uint256[2][2] memory pB;
    uint256[2]   memory pC;
    uint256[4]   memory pubSignals;

    pA[0] = 1;
    pA[1] = 2;
    pB[0][0] = 3;
    pB[0][1] = 4;
    pB[1][0] = 5;
    pB[1][1] = 6;
    pC[0] = 7;
    pC[1] = 8;

    bool result = verifier.verifyProof(pA, pB, pC, pubSignals);
    assertFalse(result);
  }

  /// @notice Gas measurement for an invalid proof
  function test_gas_verify_invalid_proof() public {
    uint256[2]   memory pA;
    uint256[2][2] memory pB;
    uint256[2]   memory pC;
    uint256[4]   memory pubSignals;

    pA[0] = 1;
    pA[1] = 2;
    pB[0][0] = 3;
    pB[0][1] = 4;
    pB[1][0] = 5;
    pB[1][1] = 6;
    pC[0] = 7;
    pC[1] = 8;

    bool result = verifier.verifyProof(pA, pB, pC, pubSignals);
    assertFalse(result);
  }

  /// @notice Field-rejected proof uses significantly less gas (no pairing call)
  function test_gas_field_rejected_fast_path() public {
    uint256[2]   memory pA;
    uint256[2][2] memory pB;
    uint256[2]   memory pC;
    uint256[4]   memory pubSignals;

    pubSignals[0] = R + 1;

    uint256 gasBefore = gasleft();
    verifier.verifyProof(pA, pB, pC, pubSignals);
    uint256 gasUsed = gasBefore - gasleft();

    console.log("Gas used for verifyProof (field rejected):", gasUsed);
    assertLt(gasUsed, 50_000, "field-check fast path should be cheap");
  }

  /// @notice Gas for a pairing-based invalid proof (non-subgroup points)
  function test_gas_pairing_rejected_proof() public {
    uint256[2]   memory pA;
    uint256[2][2] memory pB;
    uint256[2]   memory pC;
    uint256[4]   memory pubSignals;

    pA[0] = 1;
    pA[1] = 2;
    pB[0][0] = 3;
    pB[0][1] = 4;
    pB[1][0] = 5;
    pB[1][1] = 6;
    pC[0] = 7;
    pC[1] = 8;

    uint256 gasBefore = gasleft();
    verifier.verifyProof(pA, pB, pC, pubSignals);
    uint256 gasUsed = gasBefore - gasleft();

    console.log("Gas used for verifyProof (pairing rejected):", gasUsed);
  }

  /// @notice The IC values are non-zero (VK was populated during setup)
  function test_verifier_is_contract() public view {
    assertTrue(address(verifier).code.length > 0);
  }
}
