const { Connection, Keypair } = require("@solana/web3.js");
const { AnchorProvider,  Wallet } = require("@coral-xyz/anchor");
const { decode } = require('bs58');

export const API_KEY = "YOUR_TENSOR_API_KEY";
export const helius_url = "https://mainnet.helius-rpc.com/?api-key=<YOUR_HELIUS_RPC_KEY>";
export const connection = new Connection(helius_url);
export const provider = new AnchorProvider(connection, new Wallet(Keypair.generate()), {
    commitment: "confirmed",
});
export const keypair = Keypair.generate();

// you can use your own wallet at your own risk instead
//var privKey = "";
//export const keypair = Keypair.fromSecretKey(decode(privKey));
