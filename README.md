# TComp SDK

- [Getting Started](#getting-started)
- [Example Code](#example-code)

## Getting Started

### From npm/yarn (RECOMMENDED)

```
# yarn
yarn add @tensor-oss/tcomp-sdk
# npm
npm install @tensor-oss/tcomp-sdk
```

### From source

```sh
git clone https://github.com/tensor-hq/tcomp-sdk.git
cd tcomp-sdk/
yarn
# Build JS files
yarn tsc
```

## Example Code


```ts
const { AnchorProvider, Wallet } = require("@project-serum/anchor");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const {
  TCompSDK,
} = require("@tensor-oss/tcomp-sdk");

const conn = new Connection("https://api.mainnet-beta.solana.com");
const provider = new AnchorProvider(conn, new Wallet(Keypair.generate()));
const tcompSdk = new TCompSDK({ provider });

// Listing cNFT
const {
  tx: { ixs },
} = await tcompSdk.list({
  // Retrieve these fields from DAS API
  merkleTree,
  root,
  canopyDepth,
  index,
  proof,
  dataHash,
  creatorsHash,
  delegate: delegatePk,

  owner: ownerPk,
  payer: payerPk,
  amount: new BN(priceLamports), // in lamports
  expireInSec: expireIn ? new BN(expireIn) : null, // seconds until listing expires
  privateTaker: takerPk, // optional: only this wallet can buy this listing
});

// Buying cNFT
const {
  tx: { ixs },
} = await tcompSdk.buy({
  // Retrieve these fields from DAS API
  merkleTree,
  root,
  canopyDepth,
  index,
  proof,
  sellerFeeBasisPoints,
  metaHash,
  creators,

  payer: payerPk,
  buyer: buyerPk,
  owner: ownerPk,
  maxAmount: new BN(priceLamports),
  optionalRoyaltyPct: 100, // currently required to be 100% (enforced)
});


// Bidding on a single cNFT
const {
  tx: { ixs },
} = await tcompSdk.bid({
  owner: ownerPk,
  amount: new BN(priceLamports),
  expireInSec: expireIn ? new BN(expireIn) : null, // seconds until listing expires
  privateTaker: takerPk, // optional: only this wallet can sell into this bid
  bidId: new PublicKey(assetId), // asset ID of nft to bid on
  targetId: new PublicKey(assetId), // asset ID of nft to bid on
  target: Target.AssetId,
  quantity: 1,

  // Ignore these for now (advanced usage)
  margin: null,
  field: null,
  fieldId: null,
});
```
