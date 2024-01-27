const { PublicKey, Transaction } = require("@solana/web3.js");
const { TCompSDK } = require("@tensor-oss/tcomp-sdk");
const { ConcurrentMerkleTreeAccount } = require('@solana/spl-account-compression');
const BN = require('bn.js');
const { retrieveDASAssetFields, retrieveDASProofFields } = require('./helpers');
const { keypair, connection, provider } = require('./common');


async function constructListTx(mint: string, amountLamports: number) {

  // instantiate TCompSDK
  const tcompSdk = new TCompSDK({ provider });

  // query DAS for assetProof and asset info
  const proofFields = await retrieveDASProofFields(mint);
  const assetFields = await retrieveDASAssetFields(mint);

  // construct vars for tcompSdk.list
  const merkleTree = new PublicKey(proofFields.tree_id);
  const owner = keypair.publicKey;
  const proof = proofFields.proof.map((p) => { const pPub = new PublicKey(p); return pPub.toBuffer() });
  const rootPK = new PublicKey(proofFields.root)
  const root = new Uint8Array(rootPK.toBuffer())
  const dataHashPK = new PublicKey(assetFields.compression.data_hash);
  const dataHash = dataHashPK.toBuffer();
  const creatorsHashPK = new PublicKey(assetFields.compression.creator_hash);
  const creatorsHash = creatorsHashPK.toBuffer()
  const index = assetFields.compression.leaf_id;
  const amount = new BN(amountLamports);
  // retrieve canopyDepth for shorter proofPath ==> less bytes needed for tx
  const canopyDepth = await ConcurrentMerkleTreeAccount.fromAccountAddress(connection, merkleTree).then(t => t.getCanopyDepth());

  // construct list instructions
  const {
    tx: { ixs },
  } = await tcompSdk.list({
    merkleTree,
    owner,
    proof,
    root,
    dataHash,
    creatorsHash,
    index,
    amount,
    canopyDepth
  });

  // construct transaction
  const transaction = new Transaction().add(...ixs);
  const blockhash = await connection.getLatestBlockhash().then((res) => res.blockhash);
  transaction.recentBlockhash = blockhash;
  transaction.sign(keypair);
  console.log(transaction);

  // uncomment the following fields if you want to actually execute the transaction

  //const txHash = await connection.sendRawTransaction(transaction.serialize(), {
  //    skipPreflight: true,
  //});
  //console.log("listed with hash " + txHash);

};
constructListTx("DWhNshv2rhfeUC5ddKzbmMtAS1V6bxdS3S7N7VRZbPph", 0.5 / 0.000_000_001);
