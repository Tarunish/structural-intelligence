/**
 * Stellar SDK Integration — Web3 Bonus
 * Connects the Structural Intelligence pipeline to Stellar blockchain.
 * Stores analysis results on-chain and retrieves them for audit.
 *
 * Usage: import { storeAnalysisOnChain, getAnalysisFromChain } from './stellar-integration.js'
 */

import { 
  Contract, 
  SorobanRpc, 
  TransactionBuilder, 
  Networks, 
  BASE_FEE,
  Keypair,
  xdr,
  nativeToScVal,
  scValToNative
} from "@stellar/stellar-sdk";

// ─────────────────────────────────────────────
// CONFIG — update CONTRACT_ID after deployment
// ─────────────────────────────────────────────

const CONFIG = {
  NETWORK: "testnet",
  RPC_URL: "https://soroban-testnet.stellar.org",
  CONTRACT_ID: "YOUR_CONTRACT_ID_HERE",  // Replace after soroban deploy
  NETWORK_PASSPHRASE: Networks.TESTNET,
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function getServer() {
  return new SorobanRpc.Server(CONFIG.RPC_URL);
}

async function sha256Hash(data) {
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─────────────────────────────────────────────
// STORE ANALYSIS ON CHAIN
// ─────────────────────────────────────────────

/**
 * Store structural analysis results on Stellar blockchain.
 * Called after pipeline completes.
 * 
 * @param {object} pipelineResult - Full pipeline output from /api/full-pipeline
 * @param {string} secretKey - User's Stellar secret key (from Freighter wallet)
 * @returns {object} { txHash, planHash, explorerUrl }
 */
export async function storeAnalysisOnChain(pipelineResult, secretKey) {
  const server = getServer();
  const keypair = Keypair.fromSecret(secretKey);
  const account = await server.getAccount(keypair.publicKey());

  const parsed = pipelineResult.parsed;
  const materials = pipelineResult.materials;
  const summary = parsed.summary || {};

  // Generate hash of the floor plan data (immutable fingerprint)
  const planHash = await sha256Hash({
    walls: (parsed.walls ? parsed.walls.length : 0),
    rooms: (parsed.rooms ? parsed.rooms.length : 0),
    timestamp: Date.now()
  });

  const contract = new Contract(CONFIG.CONTRACT_ID);

  // Build arguments matching the Rust contract signature
  const args = [
    nativeToScVal(planHash, { type: "string" }),
    nativeToScVal(Math.floor(Date.now() / 1000), { type: "u64" }),
    nativeToScVal(summary.total_walls || 0, { type: "u32" }),
    nativeToScVal(summary.load_bearing || 0, { type: "u32" }),
    nativeToScVal(summary.partition || 0, { type: "u32" }),
    nativeToScVal(summary.total_rooms || 0, { type: "u32" }),
    nativeToScVal(Math.round((materials.estimated_total_cost_inr || 0) * 100), { type: "u64" }),
    nativeToScVal(getPrimaryMaterial(materials.recommendations), { type: "string" }),
    nativeToScVal((materials.summary ? materials.summary.total_concerns : 0) || 0, { type: "u32" }),
    nativeToScVal(keypair.publicKey(), { type: "string" }),
  ];

  // Build transaction
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: CONFIG.NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("store_analysis", ...args))
    .setTimeout(30)
    .build();

  // Simulate first (Soroban requirement)
  const simResult = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  // Prepare and sign
  const prepared = SorobanRpc.assembleTransaction(tx, simResult).build();
  prepared.sign(keypair);

  // Submit
  const sendResult = await server.sendTransaction(prepared);
  if (sendResult.status === "ERROR") {
    throw new Error(`Transaction failed: ${sendResult.errorResult}`);
  }

  // Wait for confirmation
  let txResult;
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 2000));
    txResult = await server.getTransaction(sendResult.hash);
    if (txResult.status !== SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) break;
  }

  const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${sendResult.hash}`;

  return {
    txHash: sendResult.hash,
    planHash,
    explorerUrl,
    status: (txResult ? txResult.status : null) || "SUBMITTED",
  };
}

// ─────────────────────────────────────────────
// READ ANALYSIS FROM CHAIN
// ─────────────────────────────────────────────

/**
 * Retrieve a stored analysis from blockchain by plan hash.
 * @param {string} planHash - The SHA256 hash returned during store
 * @returns {object} Structural record from chain
 */
export async function getAnalysisFromChain(planHash) {
  const server = getServer();
  const contract = new Contract(CONFIG.CONTRACT_ID);

  // Use a random keypair for read-only simulation
  const dummyKeypair = Keypair.random();
  const account = await server.getAccount(dummyKeypair.publicKey()).catch(() => {
    // If account doesn't exist, create a dummy account object
    return { accountId: () => dummyKeypair.publicKey(), sequenceNumber: () => "0", incrementSequenceNumber: () => {} };
  });

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: CONFIG.NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("get_analysis", nativeToScVal(planHash, { type: "string" })))
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error("Record not found on chain");
  }

  const returnVal = (simResult.result ? simResult.result.retval : null);
  if (!returnVal) return null;

  return scValToNative(returnVal);
}

/**
 * Verify a plan exists on chain (quick audit check)
 */
export async function verifyPlanOnChain(planHash) {
  const server = getServer();
  const contract = new Contract(CONFIG.CONTRACT_ID);

  const account = { 
    accountId: () => Keypair.random().publicKey(),
    sequenceNumber: () => "0",
    incrementSequenceNumber: () => {}
  };

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: CONFIG.NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("verify_plan", nativeToScVal(planHash, { type: "string" })))
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  const returnVal = (simResult.result ? simResult.result.retval : null);
  return returnVal ? scValToNative(returnVal) : false;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function getPrimaryMaterial(recommendations) {
  if (!recommendations || recommendations.length === 0) return "RCC";
  const lb = recommendations.find(r => r.element_type === "LOAD_BEARING");
  return (lb && lb.top_materials && lb.top_materials[0] && lb.top_materials[0].material ? lb.top_materials[0].material.name : "RCC") || "RCC";
}

/**
 * Connect Freighter wallet (browser extension)
 * Returns public key of connected account.
 */
export async function connectFreighterWallet() {
  if (typeof window === "undefined" || !window.freighter) {
    throw new Error("Freighter wallet not installed. Get it at freighter.app");
  }
  
  await window.freighter.setAllowed();
  const pubKey = await window.freighter.getPublicKey();
  const network = await window.freighter.getNetwork();
  
  return { publicKey: pubKey, network };
}

/**
 * Sign transaction with Freighter (no secret key exposure)
 */
export async function signWithFreighter(transactionXdr) {
  const signed = await window.freighter.signTransaction(transactionXdr, {
    network: CONFIG.NETWORK,
  });
  return signed;
}
