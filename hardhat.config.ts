import 'dotenv/config';
import {HardhatUserConfig} from 'hardhat/types';
import '@typechain/hardhat';
import "@nomiclabs/hardhat-ethers";
import {node_url, accounts} from './network';


const config: HardhatUserConfig = {
  solidity: {
    version: '0.6.6',
  },
  networks: {   
    mainnet: {
      url: node_url('mainnet'),
      accounts: accounts('mainnet'),
      gas: 'auto'

    },
    kovan: {
      url: node_url('kovan'),
      accounts: accounts('kovan'),
      gas: 'auto'
    },
    rinkeby: {
      url: node_url('rinkeby'),
      accounts: accounts('rinkeby'),
      gas: 'auto'
    },
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
};

export default config;
