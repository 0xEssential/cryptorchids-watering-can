import 'dotenv/config';
import { ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { address, abi } from "./CryptOrchidERC721.json";
import { BigNumber } from '@ethersproject/bignumber';
import Discord, { User } from 'discord.js';

const discordBot = new Discord.Client();

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_USER_ID = process.env.DISCORD_USER_ID;

function readyForWatering(
  { alive, plantedAt, waterLevel }: { alive: boolean, plantedAt: BigNumber, waterLevel: BigNumber },
  GROWTH_CYCLE: BigNumber,
) {
  if (!alive) return false;

  const now = new Date();
  const utcMillisecondsSinceEpoch = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const utcSecondsSinceEpoch = Math.round(utcMillisecondsSinceEpoch / 1000);

  const elapsed = BigNumber.from(utcSecondsSinceEpoch).sub(plantedAt);
  const fullCycles = Math.floor(elapsed.div(GROWTH_CYCLE).toNumber());

  return waterLevel.lt(fullCycles);
}

const discordSetup = async (): Promise<User> => {
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
  const discordUser = DISCORD_USER_ID ? await discordSetup() : null;
  const accounts = await ethers.getSigners();
  const CryptOrchidsContract = await ethers.getContractAt(
    abi,
    address,
    accounts[0]
  );

  const ownedCount = await CryptOrchidsContract.balanceOf(accounts[0].address);

  for (let index = 0; index < ownedCount.toNumber(); index++) {
    const token = await CryptOrchidsContract.tokenOfOwnerByIndex(accounts[0].address, index);
    const alive = await CryptOrchidsContract.alive(token - 1);
    
    if (!alive) {
      await discordUser?.send(`CryptOrchid #${token} is dead - please compost it so a new bulb can be planted.`)
      continue;
    }
    const { 1: plantedAt, 2: waterLevel } = await CryptOrchidsContract.getTokenMetadata(token);

    const orchid = {
      token,
      alive,
      waterLevel,
      plantedAt
    } 

    const GROWTH_CYCLE = await CryptOrchidsContract.GROWTH_CYCLE();

    if (readyForWatering(orchid, GROWTH_CYCLE)){
      const gas = await CryptOrchidsContract.estimateGas.water(token);
      
      const result = await CryptOrchidsContract.water(token, {
        gasLimit: Math.max(
          gas.toNumber(),
          parseInt(process.env.GAS_LIMIT || '0') // set a GAS_LIMIT env var to limit gas used
        ),
      });

      await discordUser?.send(
        `CryptOrchid #${token} watered in transaction: 
        \`\`\`
        ${JSON.stringify(result, null, 2)}
        \`\`\`
        
        View on etherscan: https://rinkeby.etherscan.io/tx/${result.hash}`
      );
      continue;
    }

    await discordUser?.send(
      `CryptOrchid #${token} not ready for watering.`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });