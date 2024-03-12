const {
  PublicKey,
  Transaction,
  Connection,
  SystemProgram,
} = require("@solana/web3.js");
const {
  TCompSDK,
  findListStatePda,
} = require("@tensor-oss/tcomp-sdk");
const {
  ConcurrentMerkleTreeAccount,
} = require("@solana/spl-account-compression");
const {
  retrieveDASAssetFields,
  retrieveDASProofFields,
  constructMetaHash,
  retrieveLowestListingHash,
} = require("./helpers");
const { keypair } = require('./common');

async function constructBuyTx(slug) {
  const provider = new Connection("https://api.mainnet-beta.solana.com");

  const tcompSdk = new TCompSDK({ provider });

  const mint = await retrieveLowestListingHash(slug);

  const proofFields = await retrieveDASProofFields(mint);
  const assetFields = await retrieveDASAssetFields(mint);

  const listStatePda = findListStatePda({ assetId: new PublicKey(mint) })[0];
  const listState = await tcompSdk.fetchListState(listStatePda);

  const merkleTree = new PublicKey(proofFields.tree_id);
  const proof = proofFields.proof.map((p) => Buffer.from(p));
  const root = new Uint8Array(new PublicKey(proofFields.root).toBuffer());
  const creators = assetFields.creators.map((creator) => ({
    address: new PublicKey(creator.address),
    share: creator.share,
    verified: creator.verified,
  }));
  const metaHash = await constructMetaHash(mint);
  const sellerFeeBasisPoints = assetFields.royalty.basis_points;
  const index = assetFields.compression.leaf_id;
  const maxAmount = listState.amount;
  const makerBroker = listState.makerBroker;
  const owner = listState.owner;
  const buyer = keypair.publicKey;
  const rentDest = listState.rentPayer;
  const canopyDepth = await ConcurrentMerkleTreeAccount.fromAccountAddress(
    provider,
    merkleTree
  ).then((t) => t.getCanopyDepth());

  const { tx: { ixs } } = await tcompSdk.buy({
    merkleTree,
    proof,
    root,
    metaHash,
    creators,
    sellerFeeBasisPoints,
    index,
    maxAmount,
    makerBroker,
    owner,
    buyer,
    rentDest,
    canopyDepth
  });

  const transaction = new Transaction().add(...ixs);
  const blockhash = await provider.getRecentBlockhash().then((res) => res.blockhash);
  transaction.recentBlockhash = blockhash;
  transaction.sign(keypair);

  console.log(transaction);

  // Uncomment the following lines if you want to actually execute the transaction

  // const txHash = await provider.sendRawTransaction(transaction.serialize(), {
  //   skipPreflight: true,
  // });
  // console.log("Bought with hash: " + txHash);
}

constructBuyTx("e83d8eba-269e-4af8-889b-e26d4287fd52");

