const { PublicKey, Transaction } = require("@solana/web3.js");
const { BorshAccountsCoder } = require("@coral-xyz/anchor");
const { TCompSDK } = require("@tensor-oss/tcomp-sdk");
const { TokenStandard } = require('@metaplex-foundation/mpl-bubblegum');
const { ConcurrentMerkleTreeAccount } = require('@solana/spl-account-compression');
const BN = require('bn.js');
const { retrieveDASAssetFields, retrieveDASProofFields, retrieveHighestCollectionBidAddress, constructMetaHash } = require('./helpers');
const { keypair, connection, provider } = require('./common');
const TensorWhitelist = require("@tensor-oss/tensorswap-sdk/dist/tensor_whitelist/idl/tensor_whitelist");


async function constructSellTx(slug: string, mint: string) {

    // instantiate TCompSDK
    const tcompSdk = new TCompSDK({ provider });

    // instantiate BorshAccountsCoder with whitelist IDL layout
    const wlAccountCoder = new BorshAccountsCoder(TensorWhitelist.IDL);

    // query DAS for assetProof and asset info
    const proofFields = await retrieveDASProofFields(mint);
    const assetFields = await retrieveDASAssetFields(mint);

    // if you don't want to use the API, but are retrieving the highest collection bid otherwise (e.g. via on-chain indexing + RPC WS), you can use that corresponding account address
    const collectionBidAddress = await retrieveHighestCollectionBidAddress(slug);

    // fetch bid state
    const bidState = await tcompSdk.fetchBidState(new PublicKey(collectionBidAddress));

    // decode WL account to see whether collection is verified via voc or otherwise
    const whitelist = new PublicKey(bidState.targetId);
    const stats = await connection.getAccountInfo(whitelist);
    const decoded_account = wlAccountCoder.decode("whitelist", stats.data);

    var targetData;
    // if voc is null, construct targetData via preferred branch (takeBidMetaHash)
    if (decoded_account.voc === null) {

        // utilizes metaHash construction example, so DAS fields get refetched -> not the best way, but the least complicated! :)
        const metaHash = await constructMetaHash(mint);
        targetData = {
            target: "assetIdOrFvcWithoutField",
            data: {
                metaHash: metaHash,
                creators: assetFields.creators.map((creator) => ({
                    address: new PublicKey(creator.address),
                    share: creator.share,
                    verified: creator.verified,
                })),
                sellerFeeBasisPoints: assetFields.royalty.basis_points
            }
        };
    }
    // if voc is not null, construct targetData via takeBidFullMeta (construction of metadataArgs same as in metaHash construction, so we reuse
    // that constructMetaHash helper function here with returnArgs=true) => once again not the most efficient way, but the least complicated 
    else {
        const metadataHashWithMetadataArgs = await constructMetaHash(mint, true);

        targetData = {
            target: "rest",
            data: {
                metadata: metadataHashWithMetadataArgs.metadataArgs
            }
        };
    }

    // construct vars for tcompSdk.takeBid
    const bidId = bidState.bidId;
    const merkleTree = new PublicKey(proofFields.tree_id);
    const proof = proofFields.proof.map((p) => { const pPub = new PublicKey(p); return pPub.toBuffer() });
    const rootPK = new PublicKey(proofFields.root);
    const root = new Uint8Array(rootPK.toBuffer());
    const minAmount = new BN(bidState.amount);
    const makerBroker = bidState.makerBroker;
    const owner = bidState.owner;
    const index = assetFields.compression.leaf_id;
    const rentDest = bidState.rentPayer;
    const seller = keypair.publicKey;
    const margin = bidState.margin;
    // retrieve canopyDepth for shorter proofPath ==> less bytes needed for tx
    const canopyDepth = await ConcurrentMerkleTreeAccount.fromAccountAddress(connection, merkleTree).then(t => t.getCanopyDepth());

    // construct takeBid instructions
    const {
        tx: { ixs },
    } = await tcompSdk.takeBid({
        targetData,
        bidId,
        merkleTree,
        proof,
        root,
        index,
        minAmount,
        makerBroker,
        owner,
        rentDest,
        seller,
        margin,
        canopyDepth,
        whitelist
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
    //console.log("sold with hash " + txHash);

};
constructSellTx("c1476d4b-5a48-4b3b-b9d8-576825423660", "Dc8XN5WMVgJi7EWdrnH8agvuGTWzTwj1EZXwXtJozEf1");
