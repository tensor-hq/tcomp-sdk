const { PublicKey, Transaction } = require("@solana/web3.js");
const { TCompSDK } = require("@tensor-oss/tcomp-sdk");
const BN = require('bn.js');
const { keypair, connection, provider } = require('./common');


async function constructCancelCollectionBidTx(bidStateAccount: string) {

    // instantiate TCompSDK
    const tcompSdk = new TCompSDK({ provider });

    // fetch bid state
    const bidState = await tcompSdk.fetchBidState(new PublicKey(bidStateAccount));

    // construct vars for tcompSdk.cancelBid
    const bidId = bidState.bidId;
    const owner = bidState.owner;
    const rentDest = bidState.rentPayer;

    // construct cancelBid instructions
    const {
        tx: { ixs }
    } = await tcompSdk.cancelBid({
        bidId,
        owner,
        rentDest
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
    //console.log("canceled bid with hash " + txHash);
};
constructCancelCollectionBidTx("GUbrU54hNxtktSm8uRQ1mpKhV7AKkPAmgej9DuoGRavd");
