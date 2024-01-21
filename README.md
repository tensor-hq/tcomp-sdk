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
  // For constructing metaHash, see example below
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
### Constructing metaHash

```ts
const axios = require('axios');
const BN = require('bn.js');
const { PublicKey } = require("@solana/web3.js");
const { keccak_256 } = require('js-sha3');
const { computeMetadataArgsHash } = require("@tensor-hq/tensor-common");
const { TokenStandard } = require('@metaplex-foundation/mpl-bubblegum');

const url = `https://mainnet.helius-rpc.com/?api-key=<YOUR_HELIUS_API_KEY>`

const constructMetaHash = async (mint) => {

  // query DAS API for asset info
  const assetRes = await axios.post(url, {
    jsonrpc: '2.0',
    id: '0',
    method: 'getAsset',
    params: {
      id: mint
    }
  });
  const {
    compression,
    content,
    royalty,
    creators,
    uses,
    grouping,
    supply,
    ownership: { owner, delegate },
    mutable,
  } = assetRes.data.result;
  const coll = grouping.find((group) => group.group_key === "collection")?.group_value;
  const tokenStandard = content.metadata.token_standard
  const dataHashBuffer = new PublicKey(compression.data_hash).toBuffer();

  // construct metadataArgs to hash later
  // ordering follows https://docs.metaplex.com/programs/token-metadata/accounts
  var metadataArgs = {
    name: content?.metadata?.name ?? "",
    symbol: content?.metadata?.symbol ?? " ",
    uri: content?.json_uri ?? "",
    sellerFeeBasisPoints: royalty.basis_points,
    creators: creators.map((creator) => ({
      address: new PublicKey(creator.address),
      share: creator.share,
      verified: creator.verified,
    })),
    primarySaleHappened: royalty.primary_sale_happened,
    isMutable: mutable,
    editionNonce: supply?.edition_nonce != null ? supply!.edition_nonce : null,
    tokenStandard: tokenStandard === "Fungible" ? TokenStandard.Fungible :
      tokenStandard === "NonFungibleEdition" ? TokenStandard.NonFungibleEdition :
        tokenStandard === "FungibleAsset" ? TokenStandard.FungibleAsset :
          TokenStandard.NonFungible,

    // if Helius shows a collection in groupings for a cNFT then it's verified
    collection: coll ? { key: new PublicKey(coll), verified: true } : null,
    uses: uses
      ? {
        useMethod: uses.use_method === "Burn" ? 0 : uses.use_method === "Multiple" ? 1 : 2,
        remaining: uses.remaining,
        total: uses.total,
      }
      : null,

    // currently always Original (Token2022 not supported yet)
    tokenProgramVersion: 0,
  };
  const originalMetadata = { ...metadataArgs };
  const sellerFeeBasisPointsBuffer = new BN(royalty.basis_points).toBuffer("le", 2);

  // hash function on top of candidate metaHash to compare against data_hash
  const makeDataHash = (metadataArgs) =>
    Buffer.from(
      keccak_256.digest(
        Buffer.concat([
          new PublicKey(computeMetadataArgsHash(metadataArgs)).toBuffer(),
          sellerFeeBasisPointsBuffer,
        ])
      )
    );

  // try original metadataArgs
  var hash = makeDataHash(metadataArgs);
  if (hash.equals(dataHashBuffer)) return computeMetadataArgsHash(metadataArgs);

  // try tokenStandard = null
  metadataArgs.tokenStandard = null;
  hash = makeDataHash(metadataArgs);
  if (hash.equals(dataHashBuffer)) return computeMetadataArgsHash(metadataArgs);

  // try name + uri = "", tokenStandard = null
  metadataArgs.name = "";
  metadataArgs.uri = "";
  hash = makeDataHash(metadataArgs);
  if (hash.equals(dataHashBuffer)) return computeMetadataArgsHash(metadataArgs);

  // try name + uri = "", tokenStandard = 0
  metadataArgs.tokenStandard = 0;
  hash = makeDataHash(metadataArgs);
  if (hash.equals(dataHashBuffer)) return computeMetadataArgsHash(metadataArgs);

  // try reversing creators
  metadataArgs.creators.reverse();
  metadataArgs.name = originalMetadata.name;
  metadataArgs.uri = originalMetadata.uri;
  metadataArgs.tokenStandard = originalMetadata.tokenStandard;
  hash = makeDataHash(metadataArgs);
  if (hash.equals(dataHashBuffer)) return computeMetadataArgsHash(metadataArgs);

  // can't match - return null
  return null;
};

constructMetaHash("8H6C2tGh5Yu5jGXUbFtZ17FQTDyBAEQ4LfGA527QLXYQ");
```
