const { PublicKey, Transaction } = require("@solana/web3.js");
const { TCompSDK, findListStatePda } = require("@tensor-oss/tcomp-sdk");
const BN = require('bn.js');
const { keypair, connection, provider } = require('./common');


async function constructEditListingTx(mintString: string, amountLamports: number) {

    // instantiate TCompSDK
    const tcompSdk = new TCompSDK({ provider });

    // construct vars for tcompSdk.edit
    const owner = keypair.publicKey;
    const mint = new PublicKey(mintString);
    const listState = findListStatePda({ assetId: mint })[0];
    const amount = new BN(amountLamports);

    // construct edit instructions
    const {
        tx: { ixs },
    } = await tcompSdk.edit({
        owner,
        listState,
        amount
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
    //console.log("edited listing with hash " + txHash);

};
constructEditListingTx("DWhNshv2rhfeUC5ddKzbmMtAS1V6bxdS3S7N7VRZbPph", 450000000);
