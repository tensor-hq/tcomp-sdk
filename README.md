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
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getLeafAssetId } from "@tensor-hq/tensor-common";
import {
  findListStatePda,
  findTreeAuthorityPda,
  TCompSDK,
} from "@tensor-oss/tcomp-sdk";
import BN from "bn.js";

const conn = new Connection("https://api.mainnet-beta.solana.com");
const provider = new AnchorProvider(
  conn,
  new Wallet(Keypair.generate()),
  AnchorProvider.defaultOptions()
);
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
  rentPayer: rentPayerPk, // optional: payer and recipient of listing rent
  amount: new BN(priceLamports), // in lamports
  currency: null, // optional: list for SOL or SPL tokens
  expireInSec: expireIn ? new BN(expireIn) : null, // seconds until listing expires
  privateTaker: takerPk, // optional: only this wallet can buy this listing
});


// Fetching the listing
const nonce = new BN(index);
const [treeAuthority] = findTreeAuthorityPda({ merkleTree });
const assetId = getLeafAssetId(merkleTree, nonce);
const listState = findListStatePda({ assetId });
const {
  assetId: listStateAssetId,
  owner,
  amount,
  currency,
  expiry,
  privateTaker,
  makerBroker,
  rentPayer,
} = await tcompSdk.fetchListState(listState);


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
  makerBroker,
  rentDest,
  maxAmount: new BN(priceLamports),
  optionalRoyaltyPct: 100, // currently required to be 100% (enforced)
});


// Bidding on a single cNFT
const {
  tx: { ixs },
} = await tcompSdk.bid({
  owner: ownerPk,
  rentPayer: rentPayerPK, // optional: payer and recipient of bid rent
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
