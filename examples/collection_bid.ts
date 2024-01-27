const { Transaction } = require("@solana/web3.js");
const { TensorWhitelistSDK, findWhitelistPDA } = require("@tensor-oss/tensorswap-sdk");
const { TCompSDK, Target } = require("@tensor-oss/tcomp-sdk");
const BN = require('bn.js');
const { keypair, provider, connection } = require('./common');


async function constructCollectionBidTx(slug: string, priceLamports: number) {

  // instantiate TCompSDK
  const tcompSdk = new TCompSDK({ provider });

  // fetch whitelist account
  const buffer = TensorWhitelistSDK.uuidToBuffer(slug);
  const [whitelist] = findWhitelistPDA({ uuid: buffer });

  // construct vars for tcompSdk.bid
  const target = Target.Whitelist;
  const targetId = whitelist;
  const quantity = 1;
  const owner = keypair.publicKey;
  const amount = new BN(priceLamports);

  // construct bid instructions
  const {
    tx: { ixs },
  } = await tcompSdk.bid({
    target,
    targetId,
    quantity,
    owner,
    amount,
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
  //console.log("collection bid executed with hash " + txHash);

};
constructCollectionBidTx("05c52d84-2e49-4ed9-a473-b43cab41e777", 0.1 / 0.000_000_001);
