const axios = require('axios');
const { ApolloLink, concat } = require("apollo-link");
const { HttpLink, ApolloClient, InMemoryCache, gql } = require("@apollo/client");
const { PublicKey } = require("@solana/web3.js");
const { keccak_256 } = require('js-sha3');
const { computeMetadataArgsHash } = require("@tensor-hq/tensor-common");
const { TokenStandard } = require('@metaplex-foundation/mpl-bubblegum');
const { helius_url, API_KEY } = require('./common');
const BN = require('bn.js');

export async function retrieveDASProofFields(mint: string) {
    // query DAS API for proof info
    const proofRes = await axios.post(helius_url, {
        jsonrpc: '2.0',
        id: '0',
        method: 'getAssetProof',
        params: {
            id: mint
        }
    })
        .then(response => {
            return response.data.result;
        });
    return proofRes;
}

export async function retrieveDASAssetFields(mint: string) {
    // query DAS API for asset info
    const assetRes = await axios.post(helius_url, {
        jsonrpc: '2.0',
        id: '0',
        method: 'getAsset',
        params: {
            id: mint
        }
    })
        .then(response => {
            return response.data.result;
        });
    return assetRes;
}

export async function retrieveLowestListingHash(slug: string) {
    const authLink = new ApolloLink((operation: any, forward: any) => {
        operation.setContext({
            headers: {
                "X-TENSOR-API-KEY": API_KEY,
            },
        });
        return forward(operation);
    });
    const httpLink = new HttpLink({ uri: "https://api.tensor.so/graphql", fetch });
    const client = new ApolloClient({
        link: concat(authLink, httpLink),
        cache: new InMemoryCache(),
        defaultOptions: {
            query: {
                fetchPolicy: "no-cache",
            },
        },
    });
    const query = `query ActiveListingsV2(
    $slug: String!
    $sortBy: ActiveListingsSortBy!
    $filters: ActiveListingsFilters
    $limit: Int
    $cursor: ActiveListingsCursorInputV2
  ) {
    activeListingsV2(
      slug: $slug
      sortBy: $sortBy
      filters: $filters
      limit: $limit
      cursor: $cursor
    ) {
      txs {
        mint {
          onchainId
        }
      }
    }
  }`;
    const variables = {
        "slug": slug,
        "sortBy": "PriceAsc",
        "filters": {
            "sources": ["TCOMP"]
        },
        "limit": 1
    };
    const resp = await client.query({ query: gql(query), variables: variables });
    const lowestActiveListing = resp.data.activeListingsV2.txs[0];
    return lowestActiveListing.mint.onchainId;
}

export async function retrieveHighestCollectionBidAddress(slug: string) {
    const authLink = new ApolloLink((operation: any, forward: any) => {
        operation.setContext({
            headers: {
                "X-TENSOR-API-KEY": API_KEY,
            },
        });
        return forward(operation);
    });
    const httpLink = new HttpLink({ uri: "https://api.tensor.so/graphql", fetch });
    const client = new ApolloClient({
        link: concat(authLink, httpLink),
        cache: new InMemoryCache(),
        defaultOptions: {
            query: {
                fetchPolicy: "no-cache",
            },
        },
    });
    const query = `query TcompBids($slug: String!) {
        tcompBids(slug: $slug) {
          address
          amount
          attributes {
            trait_type
            value
          }
          createdAt
          field
          fieldId
          filledQuantity
          margin
          marginNr
          ownerAddress
          quantity
          solBalance
          target
          targetId
          makerBroker
          rentPayer
        }
      }`;
    const variables = {
        "slug": slug,
    };
    const resp = await client.query({ query: gql(query), variables: variables });
    const bids = resp.data.tcompBids;
    // filter out orders that don't have sufficient balance
    const bidsWithEnoughSol = bids.filter(order => Number(order.solBalance) >= Number(order.amount) && order.quantity - order.filledQuantity > 0);
    // filter out all trait bids
    const collectionBids = bidsWithEnoughSol.filter(order => order.attributes === null);
    // sort by bid amount desc.
    const collectionBidsPriceDesc = collectionBids.sort((orderA, orderB) => Number(orderB.amount) - Number(orderA.amount));
    // return highest collection bid address
    return collectionBidsPriceDesc[0].address;
}

// helper function for constructing meta hash, return used metadataArgs as well if returnArgs=true
export async function constructMetaHash(mint: string, returnArgs=false) {

    // query DAS API for asset info
    const assetRes = await axios.post(helius_url, {
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
    const tokenStandard = content.metadata.token_standard;
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
    if (hash.equals(dataHashBuffer)) {
        if (returnArgs) {
            return {
                metaHash: computeMetadataArgsHash(metadataArgs), 
                metadataArgs: metadataArgs
            };
        }
        return computeMetadataArgsHash(metadataArgs); 
    }

    // try tokenStandard = null
    metadataArgs.tokenStandard = null;
    hash = makeDataHash(metadataArgs);
    if (hash.equals(dataHashBuffer)) {
        if (returnArgs) {
            return {
                metaHash: computeMetadataArgsHash(metadataArgs), 
                metadataArgs: metadataArgs
            };
        }
        return computeMetadataArgsHash(metadataArgs); 
    }

    // try name + uri = "", tokenStandard = null
    metadataArgs.name = "";
    metadataArgs.uri = "";
    hash = makeDataHash(metadataArgs);
    if (hash.equals(dataHashBuffer)) {
        if (returnArgs) {
            return {
                metaHash: computeMetadataArgsHash(metadataArgs), 
                metadataArgs: metadataArgs
            };
        }
        return computeMetadataArgsHash(metadataArgs); 
    }

    // try name + uri = "", tokenStandard = 0
    metadataArgs.tokenStandard = 0;
    hash = makeDataHash(metadataArgs);
    if (hash.equals(dataHashBuffer)) {
        if (returnArgs) {
            return {
                metaHash: computeMetadataArgsHash(metadataArgs), 
                metadataArgs: metadataArgs
            };
        }
        return computeMetadataArgsHash(metadataArgs); 
    }

    // try reversing creators
    metadataArgs.creators.reverse();
    metadataArgs.name = originalMetadata.name;
    metadataArgs.uri = originalMetadata.uri;
    metadataArgs.tokenStandard = originalMetadata.tokenStandard;
    hash = makeDataHash(metadataArgs);
    if (hash.equals(dataHashBuffer)) {
        if (returnArgs) {
            return {
                metaHash: computeMetadataArgsHash(metadataArgs), 
                metadataArgs: metadataArgs
            };
        }
        return computeMetadataArgsHash(metadataArgs); 
    }

    // can't match - return null
    return null;
};
