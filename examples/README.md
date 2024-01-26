# TCOMP SDK Examples

### Getting Started

#### common
The `common` file contains objects that are needed across all example files.

If you don't have an API key, you can delete that export. For `buy_lowest_listing.ts` and `sell_into_highest_collection_bid` you would then need to replace the `retrieveLowestListingHash()` and `retrieveHighestCollectionBidAddress()` calls.

Replace `helius_url` with your own generated Helius RPC URL. It is needed for fetching the DAS API and can be generated for free on Helius' website.

For `connection` you can either use a custom RPC URL or reuse your Helius RPC URL and leave it as is.

You can also replace the `keypair` var with your own keypair instead by inserting your own private key string into `privKey` and removing the comments - be aware that the examples are interacting with mainnet, please only make use of that if you know what you are doing!

#### helpers
The `helpers` file contains helper functions that are also needed across multiple example files.

#### others
All other files contain working examples to generate the corresponding Transaction objects via SDK. 

On default they only simulate the Transaction - if you remove the comment signs around the last few lines of each example, the Transaction will actually get executed on Mainnet. 
Only make use of that if you know what you are doing!

The examples are designed as scripts and are executable via:
```
ts-node <location/of/the/file/example.ts>
```

If you have any questions, join our discord and ask them in #api-sdk-questions !
