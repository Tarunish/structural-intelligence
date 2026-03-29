#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Env, String, Vec, symbol_short, log};

/// Structural Analysis Record stored on-chain
#[contracttype]
#[derive(Clone)]
pub struct StructuralRecord {
    pub plan_hash: String,          // SHA256 hash of the floor plan image
    pub timestamp: u64,             // Unix timestamp of analysis
    pub total_walls: u32,
    pub load_bearing_walls: u32,
    pub partition_walls: u32,
    pub total_rooms: u32,
    pub estimated_cost_inr: u64,    // in paise (INR × 100)
    pub primary_material: String,   // recommended primary material
    pub concerns_count: u32,
    pub analyst_address: String,    // submitting wallet
}

#[contracttype]
pub enum DataKey {
    Record(String),     // keyed by plan_hash
    RecordCount,
    AllHashes,
}

#[contract]
pub struct StructuralIntelligenceContract;

#[contractimpl]
impl StructuralIntelligenceContract {

    /// Store a new structural analysis record on-chain
    pub fn store_analysis(
        env: Env,
        plan_hash: String,
        timestamp: u64,
        total_walls: u32,
        load_bearing_walls: u32,
        partition_walls: u32,
        total_rooms: u32,
        estimated_cost_inr: u64,
        primary_material: String,
        concerns_count: u32,
        analyst_address: String,
    ) -> String {
        let record = StructuralRecord {
            plan_hash: plan_hash.clone(),
            timestamp,
            total_walls,
            load_bearing_walls,
            partition_walls,
            total_rooms,
            estimated_cost_inr,
            primary_material,
            concerns_count,
            analyst_address,
        };

        // Store record keyed by hash
        env.storage().persistent().set(
            &DataKey::Record(plan_hash.clone()), 
            &record
        );

        // Update count
        let count: u32 = env.storage().persistent()
            .get(&DataKey::RecordCount)
            .unwrap_or(0);
        env.storage().persistent().set(&DataKey::RecordCount, &(count + 1));

        log!(&env, "Structural analysis stored: hash={}", plan_hash);

        plan_hash
    }

    /// Retrieve a structural analysis record by plan hash
    pub fn get_analysis(env: Env, plan_hash: String) -> Option<StructuralRecord> {
        env.storage().persistent().get(&DataKey::Record(plan_hash))
    }

    /// Get total number of analyses stored
    pub fn get_record_count(env: Env) -> u32 {
        env.storage().persistent()
            .get(&DataKey::RecordCount)
            .unwrap_or(0)
    }

    /// Verify if a specific plan has been analysed (audit check)
    pub fn verify_plan(env: Env, plan_hash: String) -> bool {
        env.storage().persistent().has(&DataKey::Record(plan_hash))
    }

    /// Get summary stats across all stored analyses
    pub fn get_stats(env: Env) -> (u32, u64) {
        let count: u32 = env.storage().persistent()
            .get(&DataKey::RecordCount)
            .unwrap_or(0);
        // Return count and a fixed total (in production, aggregate from records)
        (count, count as u64 * 285400)
    }
}
