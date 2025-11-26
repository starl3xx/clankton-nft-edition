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

## Verification

After deployment, verify on Basescan:
```bash
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
