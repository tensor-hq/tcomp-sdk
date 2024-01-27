const { PublicKey, Transaction } = require("@solana/web3.js");
const { TCompSDK, findListStatePda } = require("@tensor-oss/tcomp-sdk");
const { ConcurrentMerkleTreeAccount } = require('@solana/spl-account-compression');
const { retrieveDASAssetFields, retrieveDASProofFields } = require("./helpers");
const { keypair, connection, provider } = require("./common");


async function constructDelistTx(mint: string) {

    // instantiate TCompSDK
    const tcompSdk = new TCompSDK({ provider });
    
    // query DAS for assetProof and asset info
    const proofFields = await retrieveDASProofFields(mint);
    const assetFields = await retrieveDASAssetFields(mint);

    // retrieve list state
    const listStatePda = findListStatePda({assetId: new PublicKey(mint)})[0];
    const listState = await tcompSdk.fetchListState(listStatePda);

    // construct vars for tcompSdk.delist
    const merkleTree = new PublicKey(proofFields.tree_id);
    const owner = keypair.publicKey;
    const rentDest = listState.rentPayer;
    const proof = proofFields.proof.map((p) => {const pPub = new PublicKey(p); return pPub.toBuffer()});
    const rootPK = new PublicKey(proofFields.root)
    const root = new Uint8Array(rootPK.toBuffer())
    const dataHashPK = new PublicKey(assetFields.compression.data_hash);
    const dataHash = dataHashPK.toBuffer();
    const creatorsHashPK = new PublicKey(assetFields.compression.creator_hash);
    const creatorsHash = creatorsHashPK.toBuffer()
    const index = assetFields.compression.leaf_id;
    // retrieve canopyDepth for shorter proofPath ==> less bytes needed for tx
    const canopyDepth = await ConcurrentMerkleTreeAccount.fromAccountAddress(connection, merkleTree).then(t => t.getCanopyDepth());

    // construct delist instructions
    const {
        tx: { ixs },
    } = await tcompSdk.delist({
        merkleTree,
        owner,
        rentDest,
        proof,
        root,
        dataHash,
        creatorsHash,
        index,
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
    //console.log("delisted with hash " + txHash);

};
constructDelistTx("DWhNshv2rhfeUC5ddKzbmMtAS1V6bxdS3S7N7VRZbPph");
