import 'dotenv/config';
import { ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { address, abi } from "./CryptOrchidERC721.json";
import Discord, { User } from 'discord.js';

const discordBot = new Discord.Client();

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_USER_ID = process.env.DISCORD_USER_ID;

const  discordSetup = async (): Promise<User> => {
  return new Promise<User>((resolve, reject) => {
    ['DISCORD_BOT_TOKEN', 'DISCORD_USER_ID'].forEach((envVar) => {
      if (!process.env[envVar]) reject(`${envVar} not set`)
    })
  
    discordBot.login(DISCORD_BOT_TOKEN);
    discordBot.on('ready', async () => {
      const user = await discordBot.users.fetch(DISCORD_USER_ID!, false)
      resolve(user);
    });
  })
}

async function main() {
  const accounts = await ethers.getSigners();
  const CryptOrchidsContract = await ethers.getContractAt(
    abi,
    address,
    accounts[0]
  );
  
  const ownedCount = await CryptOrchidsContract.balanceOf(accounts[0].address);

  const message = `CryptOrchids Watering Can setup with address ${accounts[0].address} which owns ${ownedCount} CryptOrchids`

  if (DISCORD_USER_ID) {
    const user = await discordSetup();
    await user.send(message)
  } else {
    console.warn(`CryptOrchids Watering Can setup with address ${accounts[0].address} which owns ${ownedCount} CryptOrchids`)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });