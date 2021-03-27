import 'dotenv/config';
import { ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { address, abi } from "./CryptOrchidERC721.json";
import { BigNumber } from '@ethersproject/bignumber';
import Discord from 'discord.js';

const discordBot = new Discord.Client();

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_USERNAME = process.env.DISCORD_USERNAME;
const DISCORD_SERVER = process.env.DISCORD_SERVER_ID;
const DISCORD_SNOWFLAKE = process.env.DISCORD_SNOWFLAKE;

let discordUserId = DISCORD_SNOWFLAKE;

function readyForWatering({ alive, plantedAt, waterLevel}: {alive: boolean, plantedAt: BigNumber, waterLevel: BigNumber}, GROWTH_CYCLE: BigNumber) {
  if (!alive) return false;
  const nowInEpochSeconds = Math.round(Date.now() / 1000)
  const elapsed = BigNumber.from(nowInEpochSeconds).sub(plantedAt);
  const fullCycles = Math.floor(GROWTH_CYCLE.div(elapsed).toNumber());
  return waterLevel.lt(fullCycles);
}

const  discordSetup = async (): Promise<string> => {
  
  return new Promise<string>((resolve, reject) => {
    ['DISCORD_SERVER_ID', 'DISCORD_BOT_TOKEN', 'DISCORD_USERNAME'].forEach((envVar) => {
      if (!process.env[envVar]) reject(`${envVar} not set`)
    })
  
    discordBot.login(DISCORD_BOT_TOKEN);
    discordBot.on('ready', async () => {
      try {
        const server = await discordBot?.guilds?.fetch(DISCORD_SERVER!);
        const queryMembers = await server.members.fetch({ query: DISCORD_USERNAME!.replace(/(#.+)$/, '')})
        queryMembers.array().length ? 
          resolve(queryMembers.array()[0].user.id)
          :
          reject("User snowflake not found - make sure you've invited your bot to a server that you're in.");

      } catch(e) {
        reject(e)
      }
    });
  })
}

async function main() {
  if (DISCORD_USERNAME) {
    discordUserId = await discordSetup();
  }
  
  const accounts = await ethers.getSigners();
  const CryptOrchidsContract = await ethers.getContractAt(
    abi,
    address,
    accounts[0]
  );

  const ownedCount = await CryptOrchidsContract.balanceOf(accounts[0].address);
  
  for (let index = 0; index < ownedCount.toNumber(); index++) {
    const token = await CryptOrchidsContract.tokenOfOwnerByIndex(accounts[0].address, index);
    const alive = await CryptOrchidsContract.alive(token - 1, Math.round(Date.now() / 1000));
    
    if (!alive && discordUserId) {
      await discordBot.users.fetch(discordUserId, false).then(async (user) => {
        user.send(`CryptOrchid ${token} is dead - please compost it so a new bulb can be planted.`)
      })
    }

    const waterLevel = await CryptOrchidsContract.waterLevel(token - 1);
    const { 1: plantedAt } = await CryptOrchidsContract.getTokenMetadata(token);

    const orchid = {
      token,
      alive,
      waterLevel,
      plantedAt
    } 

    const GROWTH_CYCLE = await CryptOrchidsContract.GROWTH_CYCLE();

    if (readyForWatering(orchid, GROWTH_CYCLE)){
      const gas = await CryptOrchidsContract.estimateGas.water(
        token,
        Math.round(Date.now() / 1000),
      );
  
      const result = await CryptOrchidsContract.water(token, Math.round(Date.now() / 1000), {
        gasLimit: Math.max(gas.toNumber(), parseInt(process.env.GAS_LIMIT || '0')),
      });

      if (discordUserId) {
        await discordBot.users.fetch(discordUserId, false).then(async (user) => {
          await user.send(`CryptOrchid watered in transaction: ${result}. View on etherscan: https://rinkeby.etherscan.com/tx/${result.hash}`)
        });
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });