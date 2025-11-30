# CLANKTON NFT Smart Contract

Limited edition (50 supply) NFT mint paid in CLANKTON tokens with server-verified discount pricing.

## Features

- **ERC-721** NFT standard
- **Pay in CLANKTON**: Users pay with CLANKTON ERC-20 tokens
- **Dynamic Pricing**: Discounts verified via EIP-712 signatures from backend
- **Limited Supply**: 50 editions max
- **Replay Protection**: Signatures are single-use
- **Time-Limited Mint**: Configurable start/end times
- **Updatable Metadata**: Owner can update baseURI when artwork is ready

## Contract Architecture

### ClanktonNFT.sol
Main NFT contract with:
- EIP-712 signature verification
- CLANKTON token payment handling
- Discount pricing validation
- Supply management

### Pricing Model
- **Base Price**: 20,000,000 CLANKTON
- **Discounts** (verified by backend signature):
  - Cast: -2M
  - Recast: -4M
  - Tweet: -1M
  - Follow @thepapercrane: -500K
  - Follow @starl3xx.eth: -500K
  - Follow /clankton: -500K
  - Farcaster Pro: -500K
  - Early FID (<100K): -500K

## Setup

### Prerequisites
```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install OpenZeppelin contracts
npm install @openzeppelin/contracts
```

### Environment Variables
Create `.env` file:
```bash
PRIVATE_KEY=your_deployer_private_key
SIGNER_PRIVATE_KEY=your_backend_signer_private_key
SIGNER_ADDRESS=address_of_backend_signer
BASESCAN_API_KEY=your_basescan_api_key
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=deployed_contract_address
```

## Deployment

### 1. Compile
```bash
forge build
```

### 2. Deploy to Base Mainnet
```bash
forge script contracts/Deploy.s.sol:DeployClanktonNFT \
  --rpc-url base \
  --broadcast \
  --verify
```

### 3. Deploy to Base Sepolia (testnet)
```bash
forge script contracts/Deploy.s.sol:DeployClanktonNFT \
  --rpc-url base_sepolia \
  --broadcast \
  --verify
```

## Testing

```bash
# Run tests
forge test

# Run tests with gas report
forge test --gas-report

# Run specific test
forge test --match-test testMint
```

## Verification on Basescan

Contract verification is important for transparency and user trust. Here are detailed steps:

### Prerequisites
1. Get a Basescan API key from [basescan.org](https://basescan.org/apis)
2. Add to your `.env`: `BASESCAN_API_KEY=your_api_key`

### Method 1: Verify with Forge (Recommended)

```bash
# Set your API key
export BASESCAN_API_KEY=your_api_key

# Verify the contract
forge verify-contract \
  <CONTRACT_ADDRESS> \
  contracts/ClanktonNFT.sol:ClanktonNFT \
  --chain base \
  --constructor-args $(cast abi-encode "constructor(address,address,uint256,uint256,string)" \
    0x461DEb53515CaC6c923EeD9Eb7eD5Be80F4e0b07 \
    $SIGNER_ADDRESS \
    1764720000 \
    1765324800 \
    "https://clankton-nft-edition.vercel.app/api/metadata/")
```

### Method 2: Verify on Basescan Web UI

1. Go to [basescan.org](https://basescan.org) and search for your contract address
2. Click "Contract" tab → "Verify and Publish"
3. Select:
   - Compiler Type: `Solidity (Single file)`
   - Compiler Version: `v0.8.20`
   - License: `MIT`
4. Flatten your contract first:
   ```bash
   forge flatten contracts/ClanktonNFT.sol > ClanktonNFT_flattened.sol
   ```
5. Paste the flattened source code
6. Enter constructor arguments (ABI-encoded):
   ```bash
   # Generate ABI-encoded constructor args
   cast abi-encode "constructor(address,address,uint256,uint256,string)" \
     0x461DEb53515CaC6c923EeD9Eb7eD5Be80F4e0b07 \
     <SIGNER_ADDRESS> \
     <MINT_START_TIMESTAMP> \
     <MINT_END_TIMESTAMP> \
     "https://clankton-nft-edition.vercel.app/api/metadata/"
   ```

### Method 3: Verify on Base Sepolia (Testnet)

```bash
forge verify-contract \
  <CONTRACT_ADDRESS> \
  contracts/ClanktonNFT.sol:ClanktonNFT \
  --chain base-sepolia \
  --verifier-url https://api-sepolia.basescan.org/api \
  --constructor-args $(cast abi-encode "constructor(address,address,uint256,uint256,string)" \
    <TESTNET_CLANKTON_ADDRESS> \
    $SIGNER_ADDRESS \
    <MINT_START> \
    <MINT_END> \
    "https://clankton-nft-edition.vercel.app/api/metadata/")
```

### Troubleshooting Verification

**Error: "Unable to verify"**
- Ensure compiler version matches exactly (`0.8.20`)
- Check optimizer settings match (default: 200 runs)
- Verify constructor args are ABI-encoded correctly

**Error: "Invalid API Key"**
- Get a new API key from [basescan.org/myapikey](https://basescan.org/myapikey)

**Check verification status**
```bash
forge verify-check <GUID> --chain base
```

## Admin Functions

### Update Metadata URI (when artwork is ready)
```bash
cast send <CONTRACT_ADDRESS> \
  "setBaseURI(string)" \
  "ipfs://QmYourIPFSHash/" \
  --rpc-url base \
  --private-key $PRIVATE_KEY
```

### Withdraw CLANKTON Tokens
```bash
cast send <CONTRACT_ADDRESS> \
  "withdrawAllClankton(address)" \
  <YOUR_ADDRESS> \
  --rpc-url base \
  --private-key $PRIVATE_KEY
```

### Update Signer Address
```bash
cast send <CONTRACT_ADDRESS> \
  "setSigner(address)" \
  <NEW_SIGNER_ADDRESS> \
  --rpc-url base \
  --private-key $PRIVATE_KEY
```

## Frontend Integration

The backend `/api/mint-signature` endpoint generates signatures that the frontend uses to call `mint()`:

```typescript
// 1. Get signature from backend
const response = await fetch('/api/mint-signature', {
  method: 'POST',
  body: JSON.stringify({ address: userAddress })
})
const { price, nonce, deadline, signature } = await response.json()

// 2. Approve CLANKTON spending
await clanktonContract.approve(nftContractAddress, price)

// 3. Mint NFT
await nftContract.mint(price, nonce, deadline, signature)
```

## Security Considerations

- ✅ **Replay Protection**: Signatures are single-use via `usedSignatures` mapping
- ✅ **Deadline**: Signatures expire after 5 minutes
- ✅ **Price Validation**: Price cannot exceed base price
- ✅ **EIP-712**: Industry-standard signature verification
- ✅ **Signer Control**: Only signatures from designated backend signer are valid
- ✅ **Supply Cap**: Hard limit of 50 NFTs
- ⚠️ **Signer Key Security**: CRITICAL - keep `SIGNER_PRIVATE_KEY` secure

## Contract Addresses

### Base Mainnet
- CLANKTON Token: `0x461DEb53515CaC6c923EeD9Eb7eD5Be80F4e0b07`
- ClanktonNFT: `TBD (after deployment)`

### Base Sepolia (Testnet)
- CLANKTON Token: `TBD`
- ClanktonNFT: `TBD`
