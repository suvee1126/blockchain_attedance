import hashlib
import json
import time
import math
from typing import List, Dict, Any, Optional

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two GPS coordinates in meters using Haversine formula."""
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c)

def generate_blockchain_hash(prefix: str = "0x") -> str:
    """Generate a high-entropy 256-bit cryptographic transaction hash."""
    random_bytes = hashlib.sha256(f"{time.time()}-{hashlib.sha256(str(time.time_ns()).encode()).hexdigest()}".encode()).hexdigest()
    return f"{prefix}{random_bytes}"

class Block:
    def __init__(self, index: int, timestamp: str, transactions: List[Dict[str, Any]], previous_hash: str, nonce: int = 0):
        self.index = index
        self.timestamp = timestamp
        self.transactions = transactions
        self.previous_hash = previous_hash
        self.nonce = nonce
        self.merkle_root = self.compute_merkle_root()
        self.hash = self.compute_hash()

    def compute_merkle_root(self) -> str:
        if not self.transactions:
            return hashlib.sha256(b"empty").hexdigest()
        tx_hashes = [hashlib.sha256(json.dumps(tx, sort_keys=True).encode()).hexdigest() for tx in self.transactions]
        while len(tx_hashes) > 1:
            if len(tx_hashes) % 2 != 0:
                tx_hashes.append(tx_hashes[-1])
            new_level = []
            for i in range(0, len(tx_hashes), 2):
                combined = tx_hashes[i] + tx_hashes[i+1]
                new_level.append(hashlib.sha256(combined.encode()).hexdigest())
            tx_hashes = new_level
        return tx_hashes[0]

    def compute_hash(self) -> str:
        block_string = json.dumps({
            "index": self.index,
            "timestamp": self.timestamp,
            "merkle_root": self.merkle_root,
            "previous_hash": self.previous_hash,
            "nonce": self.nonce
        }, sort_keys=True)
        return "0x" + hashlib.sha256(block_string.encode()).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "timestamp": self.timestamp,
            "transactions": self.transactions,
            "merkle_root": self.merkle_root,
            "previous_hash": self.previous_hash,
            "hash": self.hash,
            "nonce": self.nonce
        }

class BlockchainLedger:
    def __init__(self):
        self.chain: List[Block] = []
        self.pending_transactions: List[Dict[str, Any]] = []
        self.difficulty = 2
        self.create_genesis_block()

    def create_genesis_block(self):
        genesis_tx = [{
            "type": "GENESIS",
            "message": "Smart Attendance Blockchain Genesis Block Initialized",
            "timestamp": "2026-01-01T00:00:00Z",
            "tx_hash": "0x0000000000000000000000000000000000000000000000000000000000000000"
        }]
        genesis_block = Block(
            index=0,
            timestamp="2026-01-01T00:00:00Z",
            transactions=genesis_tx,
            previous_hash="0x0000000000000000000000000000000000000000000000000000000000000000",
            nonce=0
        )
        self.chain.append(genesis_block)

    @property
    def last_block(self) -> Block:
        return self.chain[-1]

    def add_transaction(self, tx: Dict[str, Any]) -> str:
        if "tx_hash" not in tx:
            tx["tx_hash"] = generate_blockchain_hash()
        tx["recorded_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.pending_transactions.append(tx)
        
        # If we have reached batch size or instant commit for attendance, mine block
        if len(self.pending_transactions) >= 1:
            self.mine_pending_transactions()
            
        return tx["tx_hash"]

    def mine_pending_transactions(self) -> Block:
        if not self.pending_transactions:
            return self.last_block

        new_block = Block(
            index=len(self.chain),
            timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            transactions=list(self.pending_transactions),
            previous_hash=self.last_block.hash,
            nonce=0
        )

        # Proof of work (simple target for fast instant response)
        target = "0x" + "0" * self.difficulty
        while not new_block.hash.startswith(target) and new_block.nonce < 5000:
            new_block.nonce += 1
            new_block.hash = new_block.compute_hash()

        self.chain.append(new_block)
        self.pending_transactions = []
        return new_block

    def is_chain_valid(self) -> bool:
        for i in range(1, len(self.chain)):
            current = self.chain[i]
            prev = self.chain[i-1]

            if current.previous_hash != prev.hash:
                return False
            if current.compute_hash() != current.hash:
                return False
        return True

    def find_transaction(self, tx_hash: str) -> Optional[Dict[str, Any]]:
        for block in self.chain:
            for tx in block.transactions:
                if tx.get("tx_hash") == tx_hash or tx.get("hash") == tx_hash or tx.get("blockchain_hash") == tx_hash:
                    return {
                        "transaction": tx,
                        "block_index": block.index,
                        "block_hash": block.hash,
                        "timestamp": block.timestamp,
                        "verified": True
                    }
    def reset(self):
        self.chain = []
        self.pending_transactions = []
        self.create_genesis_block()

# Singleton ledger instance
blockchain = BlockchainLedger()
