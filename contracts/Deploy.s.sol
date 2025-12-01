// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "./ClanktonNFT.sol";

contract DeployClanktonNFT is Script {
    // Base mainnet CLANKTON token
    address constant CLANKTON_TOKEN = 0x461DEb53515CaC6c923EeD9Eb7eD5Be80F4e0b07;

    function run() external {
        // Load deployment parameters from environment
        address signer = vm.envAddress("SIGNER_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Mint window: December 16, 2025 at 17:00 UTC
        // No end date - mint stays open until all 50 editions are sold
        uint256 mintStartTime = 1765904400; // Dec 16, 2025 17:00:00 UTC
        uint256 mintEndTime = type(uint256).max; // No time-based end

        // Initial metadata URI (can be updated later when artwork is ready)
        string memory initialBaseURI = "https://clankton-nft-edition.vercel.app/api/metadata/";

        console.log("Deploying ClanktonNFT...");
        console.log("CLANKTON Token:", CLANKTON_TOKEN);
        console.log("Signer:", signer);
        console.log("Mint Start:", mintStartTime);
        console.log("Mint End:", mintEndTime);

        vm.startBroadcast(deployerPrivateKey);

        ClanktonNFT nft = new ClanktonNFT(
            CLANKTON_TOKEN,
            signer,
            mintStartTime,
            mintEndTime,
            initialBaseURI
        );

        console.log("ClanktonNFT deployed at:", address(nft));

        vm.stopBroadcast();

        // Log contract details
        console.log("\n=== Deployment Summary ===");
        console.log("Contract:", address(nft));
        console.log("Max Supply:", nft.MAX_SUPPLY());
        console.log("Base Price:", nft.BASE_PRICE() / 10**18, "CLANKTON");
        console.log("Owner:", nft.owner());
    }
}
