const { PublicKey, Transaction } = require("@solana/web3.js");
const { TCompSDK, findListStatePda } = require("@tensor-oss/tcomp-sdk");
const { ConcurrentMerkleTreeAccount } = require("@solana/spl-account-compression");
const { retrieveDASAssetFields, retrieveDASProofFields, constructMetaHash , retrieveLowestListingHash } = require("./helpers");
const { keypair, connection, provider } = require('./common');


async function constructBuyTx(slug: string) {

    // instantiate TCompSDK
    const tcompSdk = new TCompSDK({ provider });

    // if you don't want to use the API, but are retrieving the hash of the lowest listing otherwise (e.g. via on-chain indexing + RPC WS), you can use that corresponding mint hash instead
    const mint = await retrieveLowestListingHash(slug);

    // query DAS for assetProof and asset info
    const proofFields = await retrieveDASProofFields(mint);
    const assetFields = await retrieveDASAssetFields(mint);

    // retrieve list state
    const listStatePda = findListStatePda({ assetId: new PublicKey(mint) })[0];
    const listState = await tcompSdk.fetchListState(listStatePda);

    // construct vars for tcompSdk.buy
    const merkleTree = new PublicKey(proofFields.tree_id);
    const proof = proofFields.proof.map((p) => { const pPub = new PublicKey(p); return pPub.toBuffer() });
    const rootPK = new PublicKey(proofFields.root);
    const root = new Uint8Array(rootPK.toBuffer());
    const creators = assetFields.creators.map((creator) => ({
        address: new PublicKey(creator.address),
        share: creator.share,
        verified: creator.verified,
    }));
    // utilizes metaHash construction example, so DAS fields get refetched -> not the fastest / most efficient way, but the least complicated! :)
    const metaHash = await constructMetaHash(mint);
    const sellerFeeBasisPoints = assetFields.royalty.basis_points;
    const index = assetFields.compression.leaf_id;
    const maxAmount = listState.amount;
    const makerBroker = listState.makerBroker;
    const owner = listState.owner;
    const buyer = keypair.publicKey;
    const rentDest = listState.rentPayer;
    // retrieve canopyDepth for shorter proofPath ==> less bytes / accounts needed for tx
    const canopyDepth = await ConcurrentMerkleTreeAccount.fromAccountAddress(connection, merkleTree).then(t => t.getCanopyDepth());

    // construct buy instructions
    const {
        tx: { ixs },
    } = await tcompSdk.buy({
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
    //console.log("bought with hash " + txHash);

};
constructBuyTx("e83d8eba-269e-4af8-889b-e26d4287fd52");
