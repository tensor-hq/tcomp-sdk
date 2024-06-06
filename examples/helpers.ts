const axios = require('axios');
const {
  ApolloLink,
  concat,
  HttpLink,
  ApolloClient,
  InMemoryCache,
  gql
} = require('@apollo/client');
const { PublicKey } = require('@solana/web3.js');
const { keccak_256 } = require('js-sha3');
const { computeMetadataArgsHash } = require('@tensor-hq/tensor-common');
const { TokenStandard } = require('@metaplex-foundation/mpl-bubblegum');
const { helius_url, API_KEY } = require('./common');
const BN = require('bn.js');

async function queryDASAPI(method, mint) {
  const response = await axios.post(helius_url, {
    jsonrpc: '2.0',
    id: '0',
    method: method,
    params: { id: mint }
  });
  return response.data.result;
}

export async function retrieveDASProofFields(mint) {
  return queryDASAPI('getAssetProof', mint);
}

export async function retrieveDASAssetFields(mint) {
  return queryDASAPI('getAsset', mint);
}

async function constructApolloClient() {
  const authLink = new ApolloLink((operation, forward) => {
    operation.setContext({
      headers: {
        'X-TENSOR-API-KEY': API_KEY
      }
    });
    return forward(operation);
  });

  const httpLink = new HttpLink({ uri: 'https://api.tensor.so/graphql', fetch });
  return new ApolloClient({
    link: concat(authLink, httpLink),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: { fetchPolicy: 'no-cache' }
    }
  });
}

async function retrieveListingData(slug, sortBy = 'PriceAsc') {
  const client = await constructApolloClient();

  const query = gql`
    query ActiveListingsV2(
      $slug: String!
      $sortBy: ActiveListingsSortBy!
      $filters: ActiveListingsFilters
      $limit: Int
      $cursor: ActiveListingsCursorInputV2
    ) {
      activeListingsV2(slug: $slug, sortBy: $sortBy, filters: $filters, limit: $limit, cursor: $cursor) {
        txs {
          mint {
            onchainId
          }
        }
      }
    }
  `;

  const variables = {
    slug,
    sortBy,
    filters: { sources: ['TCOMP'] },
    limit: 1
  };

  const response = await client.query({ query, variables });
  return response.data.activeListingsV2.txs[0].mint.onchainId;
}

async function retrieveCollectionBidAddress(slug) {
  const client = await constructApolloClient();

  const query = gql`
    query TcompBids($slug: String!) {
      tcompBids(slug: $slug) {
        address
        amount
        attributes {
          trait_type
          value
        }
        // ... other fields
      }
    }
  `;

  const variables = { slug };
  const response = await client.query({ query, variables });

  const bidsWithEnoughSol = response.data.tcompBids.filter(
    order => Number(order.solBalance) >= Number(order.amount) && order.quantity - order.filledQuantity > 0
  );

  const collectionBids = bidsWithEnoughSol.filter(order => order.attributes === null);

  const collectionBidsPriceDesc = collectionBids.sort((orderA, orderB) => Number(orderB.amount) - Number(orderA.amount));

  return collectionBidsPriceDesc[0].address;
}

export async function constructMetaHash(mint, returnArgs = false) {
  const assetRes = await queryDASAPI('getAsset', mint);

  const {
    compression,
    content,
    royalty,
    creators,
    uses,
    grouping,
    supply,
    ownership: { owner, delegate },
    mutable
  } = assetRes;

  const coll = grouping.find(group => group.group_key === 'collection')?.group_value;
  const tokenStandard = content.metadata.token_standard;
  const dataHashBuffer = new PublicKey(compression.data_hash).toBuffer();

  const metadataArgs = {
    // ... existing properties
  };

  const originalMetadata = { ...metadataArgs };
  const sellerFeeBasisPointsBuffer = new BN(royalty.basis_points).toBuffer('le', 2);

  const makeDataHash = metadataArgs =>
    Buffer.from(
      keccak_256.digest(
        Buffer.concat([new PublicKey(computeMetadataArgsHash(metadataArgs)).toBuffer(), sellerFeeBasisPointsBuffer])
      )
    );

  const hash = makeDataHash(metadataArgs);

  if (hash.equals(dataHashBuffer)) {
    return returnArgs ? { metaHash: computeMetadataArgsHash(metadataArgs), metadataArgs } : computeMetadataArgsHash(metadataArgs);
  }

  // ... other conditions

  return null;
}
