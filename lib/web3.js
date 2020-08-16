import { Meteor } from 'meteor/meteor';
import { TAPi18n } from 'meteor/tap:i18n';

import { Contracts } from '/imports/api/contracts/Contracts';
import { Collectives } from '/imports/api/collectives/Collectives';
import { Transactions } from '/imports/api/transactions/Transactions';
import { Tokens } from '/imports/api/tokens/tokens';
import { DAOTemplates } from '/lib/templates';
import { insertToken } from '/lib/dao';

import { BigNumber } from 'bignumber.js';
import { migrateAddress, getContractObject, getTransactionObject, parseContent, getFinality } from '/lib/interpreter';

import { log, defaults, blocktimes } from '/lib/const';

import erc20 from 'human-standard-token-abi';

const Web3 = require('web3');

let blockHeight;
let lastBlockHeightTimestamp = new Date();
let web3;

/**
* @summary check web3 plugin and connects to code obejct
*/
const _web3 = () => {
  if (!Meteor.settings.private.web3.network) {
    log('[web3 WARNING] Could not find settings to connect with Ethereum node.');
    log('[web3 FIX] Configure `private.web3.network` with an Ethereum node IP in the settings.json you are using. You can begin with providers like https://infura.io.');
    return false;
  }
  if (!web3) {
    log('[web3] Connecting to Ethereum node...');
    web3 = new Web3(new Web3.providers.HttpProvider(Meteor.settings.private.web3.network));
  }
  return web3;
};

/**
* @summary updates the status of a collective being processed
* @param {object} collective data
* @param {string} stage of current process
* @param {number} increment to percentage value
* @param {string} message to display in status
*/
const _updateStatus = (collective, stage, increment, message) => {
  const newPercentage = parseInt(collective.status.loadPercentage + increment, 10);
  const newStatus = {
    loadPercentage: (newPercentage > 100) ? 100 : newPercentage,
    blockchainSync: stage,
    publicAddress: collective.status.publicAddress,
    message,
  };

  Collectives.update({ _id: collective._id }, { $set: { status: newStatus } });
};

/**
* @summary calculates the increment size for progress bar of status update
* @param {number} maximum of relative percentage
* @param {number} arrayLength to calculate the increments on the for loop
* @returns {number} with increments to be added to status
*/
const _calcIncrement = (maximum, arrayLength) => {
  return parseFloat(maximum / arrayLength, 10);
};

/**
* @summary show all the transactions for a given public address
* @param {string} publicAddress of a contract.
*/
const _getContract = async (publicAddress, interfaceJSON) => {
  if (_web3()) {
    log(`[web3] Getting contract ABI of ${publicAddress}.`);
    const abi = JSON.parse(interfaceJSON);

    if (abi) {
      log(abi);
      const contract = new web3.eth.Contract(abi, publicAddress);
      log('[web3] JSON Interface:');
      log(contract);
      return contract;
    }
  }
  return undefined;
};

/*
Example of a contract default:
*/

const _getMembership = (address, values) => {
  if (values.memberAddress && (values.memberAddress === address)) {
    return 'MEMBER';
  }
  if (values.summoner && (values.summoner === address)) {
    return 'MEMBER';
  }
  if (values.delegateKey && (values.delegateKey === address)) {
    return 'DELEGATE';
  }
  if (values.applicant && (values.applicant === address)) {
    return 'APPLICANT';
  }
  return 'VIEWER';
};

const _setContract = (importId, contractObject) => {
  const dbContract = Contracts.findOne({ importId });
  if (dbContract) {
    log(`[web3] Updating existing contract with importId: ${importId}...`);

    Contracts.update({ _id: dbContract._id }, { $set: contractObject }, (err, res) => {
      if (err) {
        console.log(err);
      }
      return res;
    });
    return dbContract._id;
  }
  log(`[web3] Inserting new contract with importId: ${importId}...`);
  return Contracts.insert(contractObject, (err, res) => {
    if (err) {
      console.log(err);
    }
    return res;
  });
};

const _setTransaction = (userId, pollId, transactionObject) => {
  const dbContract = Transactions.findOne({ $and: [{ 'input.entityId': userId }, { 'output.entityId': pollId }] });
  if (dbContract) {
    log('[web3] Updating existing transaction...');
    Transactions.update({ _id: dbContract._id }, { $set: transactionObject }, (err, res) => {
      if (err) {
        log(err);
      }
      return res;
    });
    return dbContract._id;
  }
  log('[web3] Inserting new transaction...');
  return Transactions.insert(transactionObject, (err, res) => {
    if (err) {
      console.log(err);
    }
    return res;
  });
};

/**
* @summary obtains the address of a participant and makes sure its persisted in db
* @param {object} res the event data to parse
* @param {string} collectiveId to store to this person
* @param {string} role to return address from
*/
const _getUserAddress = (res, collectiveId, role) => {
  let settings;
  let membership;
  let authorUsername;
  let contractObject;
  if (res && res.returnValues) {
    contractObject = res.returnValues;
  } else {
    contractObject = res;
  }
  const addresses = _.uniq(_.filter(contractObject, (num) => { if (typeof num === 'string') { return web3.utils.isAddress(num); } return false; }));

  for (let i = 0; i < addresses.length; i += 1) {
    if (res.returnValues) {
      membership = _getMembership(addresses[i], res.returnValues);
    }
    if (!role ? (membership === 'MEMBER') : (membership === role)) {
      authorUsername = addresses[i].toLowerCase();
    }
    settings = {
      profile: {
        collectives: [collectiveId],
        wallet: {
          address: [
            {
              hash: addresses[i].toLowerCase(),
              chain: defaults.BLOCKCHAIN,
            },
          ],
        },
      },
    };
    migrateAddress(addresses[i], settings);
  }
  return authorUsername;
};

/**
* @summary from a log event on chain persists it into a contract database record
* @param {object} log with event descriptions from the blockchain
* @param {object} map with info how to write these eventos on the blockchain
* @param {object} state of the current smart contract being processed
* @param {string} collectiveId this is being subscribed to
* @param {object} block with data from chain of this event
*/
const _mirrorContractEvent = (event, state, collectiveId, block) => {
  log(`[web3] Mirroring blockchain event as contract action with collectiveId: ${collectiveId}...`);

  // create users required for this contract
  const user = Meteor.users.findOne({ username: event.returnValues.memberAddress.toLowerCase() });

  if (user) {
    const index = new BigNumber(event.returnValues.proposalIndex).toString();
    const elements = event.returnValues;

    const userInfo = Meteor.users.findOne({ username: elements.applicant.toLowerCase() });
    if (userInfo) {
      elements.applicantId = userInfo._id;
    }

    const contractDB = Contracts.findOne({ importId: `${collectiveId}-${index}` });

    if (contractDB) {
      log(`[web3] Updating contract in DB with block event data with importId: ${collectiveId}-${index}...`);
      const finality = getFinality(state, block.timestamp, index);
      const contractDate = new Date(block.timestamp * 1000);
      const contractBlockData = {
        keyword: `${event.transactionHash}`,
        url: `/tx/${event.transactionHash}`,
        blockchain: {
          publicAddress: event.returnValues.delegateKey.toLowerCase(),
        },
        closing: finality.closing,
        period: finality.period,
        createdAt: contractDate,
        lastUpdate: contractDate,
        timestamp: contractDate,
        signatures: [
          {
            _id: user._id,
            role: 'AUTHOR',
            username: user.username,
            status: 'CONFIRMED',
          },
        ],
      };

      Contracts.update({ _id: contractDB._id }, { $set: contractBlockData }, (error, resolve) => {
        if (error) {
          console.log(error);
        }
        return resolve;
      });
      const newContractId = contractDB._id;

      const choices = ['no', 'yes'];
      let choice;
      for (let k = 0; k < choices.length; k += 1) {
        choice = Contracts.findOne({ importId: `${collectiveId}-${index}-${choices[k]}` });

        log(`[web3] Updating details of poll choice ${index}-${choices[k]}`);

        if (choice) {
          const choiceData = {
            keyword: `${event.transactionHash}/${choices[k]}`,
            url: `/tx/${event.transactionHash}`,
            poll: [],
            pollId: newContractId,
            pollChoiceId: k.toString(),
            importId: `${collectiveId}-${index}-${choices[k]}`,
            proposalIndex: index,
            createdAt: contractDate,
            lastUpdate: contractDate,
            timestamp: contractDate,
          };
          Contracts.update({ _id: choice._id }, { $set: choiceData }, (error, resolve) => {
            if (error) {
              console.log(error);
            }
            return resolve;
          });
        }
      }
    }
  }
};

/**
* @summary gets the current shares an existing members has
* @param {object} member user data
* @param {string} ticker to check data for in wallet
*/
const _getShares = (member, collectiveId) => {
  const collective = Collectives.findOne({ _id: collectiveId });
  let shares = 0;
  for (let i = 0; i < member.profile.wallet.reserves.length; i += 1) {
    if (member.profile.wallet.reserves[i].publicAddress.toLowerCase() === collective.profile.blockchain.publicAddress.toLowerCase()) {
      shares = member.profile.wallet.reserves[i].balance;
      break;
    }
  }
  return shares;
};


/**
* @summary tallies the votes on a given transaction contract
* @param {array} voter list
*/
const _quickTally = (voter) => {
  let count = 0;
  for (let i = 0; i < voter.length; i += 1) {
    if (voter[i].votes) count += voter[i].votes;
  }
  return count;
};

/**
* @summary from a log event on chain persists it into a transaction database record
* @param {object} log with event descriptions from the blockchain
* @param {object} map with info how to write these eventos on the blockchain
* @param {string} collectiveId this is being subscribed to
* @param {object} block with data from chain of this event
*/
const _mirrorTransaction = (event, collectiveId, block) => {
  // create users required for this transaction
  const authorUsername = _getUserAddress(event, collectiveId, 'MEMBER');
  const user = Meteor.users.findOne({ username: authorUsername });
  const index = new BigNumber(event.returnValues.proposalIndex).toString();
  log(`[web3] Mirroring blockchain event as transaction action with index: ${index}...`);

  if (user) {
    const contract = Contracts.findOne({ importId: `${collectiveId}-${index}` });
    if (contract) {
      let poll;
      switch (event.returnValues.uintVote) {
        case '1': // yes
          poll = Contracts.findOne({ keyword: `${contract.keyword}/yes` });
          break;
        case '2': // no
          poll = Contracts.findOne({ keyword: `${contract.keyword}/no` });
          break;
        default:
      }
      if (poll) {
        const voter = Meteor.users.findOne({ username: event.returnValues.memberAddress.toLowerCase() });
        log(`[web3] Tallying vote of user ${event.returnValues.memberAddress.toLowerCase()}...`);
        if (voter) {
          const shares = _getShares(voter, collectiveId);
          const ticket = {
            shares,
            timestamp: new Date(block.timestamp * 1000),
            contract: {
              _id: contract._id,
            },
            poll: {
              _id: poll._id,
            },
            address: contract.keyword,
            collectiveId: contract.collectiveId,
            blockchain: {
              tickets: [
                {
                  hash: block.blockHash,
                  status: 'CONFIRMED',
                  value: shares.toNumber(),
                },
              ],
              coin: {
                code: defaults.TOKEN,
              },
              publicAddress: event.returnValues.memberAddress.toLowerCase(),
              score: {
                totalConfirmed: shares.toString(),
                totalPending: '0',
                totalFail: '0',
                finalConfirmed: shares.toNumber(),
                finalPending: 0,
                finalFail: 0,
                value: 0,
              },
            },
          };
          const transactionObject = getTransactionObject(user, ticket);
          const userId = user._id;
          const pollId = poll._id;
          const txId = _setTransaction(userId, pollId, transactionObject);

          // store vote in contract
          const pollChoiceContract = Contracts.findOne({ _id: transactionObject.output.entityId });
          log(`[web3] Updating tally in poll choice id: ${transactionObject.output.entityId}`);

          const voterList = pollChoiceContract.tally.voter;
          let found = false;
          for (let i = 0; i < voterList.length; i += 1) {
            if (voterList[i]._id === userId) {
              found = true;
              voterList[i].votes = shares;
            }
          }
          if (!found) {
            voterList.push({
              _id: userId,
              votes: parseInt(shares, 10),
            });
          }
          pollChoiceContract.tally.lastTransaction = txId;
          pollChoiceContract.tally.voter = voterList;

          const quickTally = _quickTally(voterList);
          pollChoiceContract.blockchain.score.finalConfirmed = quickTally;
          pollChoiceContract.blockchain.score.totalConfirmed = quickTally.toString();

          Contracts.update({ importId: pollChoiceContract.importId }, { $set: { tally: pollChoiceContract.tally, 'blockchain.score': pollChoiceContract.blockchain.score } });
        }
      }
    }
  }
};

/**
* @summary checks on a list if the user already received something.
* @param {string} username to check
* @param {array} list of precedents
* @param {string} collectiveId of precedent
*/
const _checkPrecedent = (username, collectiveId) => {
  const user = Meteor.users.findOne({ username });
  const collective = Collectives.findOne({ _id: collectiveId });

  if (user.profile.wallet.reserves && user.profile.wallet.reserves.length > 0) {
    const reserve = _.findWhere(user.profile.wallet.reserves, { publicAddress: collective.profile.blockchain.publicAddress.toLowerCase() });

    if (reserve && reserve.balance) {
      return reserve.balance;
    }
  }

  return 0;
};

/**
* @summary updates the wallet settings for approved processed proposals
* @param {object} log with event descriptions from the blockchain
* @param {object} map with info how to write these eventos on the blockchain
* @param {object} state with status of contract
* @param {string} collectiveId this is being subscribed to

*/
const _mirrorTransactionState = (event, collectiveId, block) => {
  log(`[web3] Transaction state with collectiveId: ${collectiveId}...`);

  if (event.returnValues.didPass) {
    _getUserAddress(event, collectiveId);
    const authorUsername = event.returnValues.applicant.toLowerCase();
    const applicant = Meteor.users.findOne({ username: event.returnValues.applicant.toLowerCase() });
    const collective = Collectives.findOne({ _id: collectiveId });

    let reserves;
    const shares = parseInt(parseInt(new BigNumber(event.returnValues.sharesRequested).toNumber(), 10) + _checkPrecedent(authorUsername, collectiveId), 10);

    if (applicant.profile.wallet && applicant.profile.wallet.reserves && applicant.profile.wallet.reserves.length > 0) {
      reserves = applicant.profile.wallet.reserves;
      for (let i = 0; i < reserves.length; i += 1) {
        if (reserves[i].token === defaults.TOKEN && reserves[i].publicAddress === collective.profile.blockchain.publicAddress.toLowerCase()) {
          reserves[i].balance = shares;
          reserves[i].available = reserves[i].balance;
        }
      }
    } else {
      reserves = [{
        collectiveId,
        publicAddress: collective.profile.blockchain.publicAddress.toLowerCase(),
        token: defaults.TOKEN,
        balance: shares,
        available: shares,
        placed: 0,
        memberSince: new Date(block.timestamp * 1000),
        membership: 'MEMBER',
      }];
    }

    const settings = {
      profile: {
        wallet: {
          address: [{
            hash: authorUsername,
            chain: defaults.BLOCKCHAIN,
          }],
          ledger: [{
            collectiveId,
            txId: event.transactionHash,
            token: defaults.TOKEN,
            value: parseInt(new BigNumber(event.returnValues.sharesRequested).toNumber(), 10),
            timestamp: new Date(block.timestamp * 1000),
          }],
          reserves,
        },
      },
    };

    log(`[web3] Updating user data with reserves: ${JSON.stringify(reserves)}...`);
    migrateAddress(authorUsername, settings);
  }

  const index = new BigNumber(event.returnValues.proposalIndex).toString();
  const contractDB = Contracts.findOne({ importId: `${collectiveId}-${index}` });
  if (contractDB) {
    Contracts.update({ _id: contractDB._id }, { $set: { processed: true, didPass: event.returnValues.didPass } });
    log(`[web3] Processed proposal ${index}...`);
  }
};


const _mirrorContractState = (state, index, collectiveId) => {
  const proposal = state.proposalQueue[index];
  log(`[web3] Mirroring blockchain proposal with index ${index}`);

  // create users required for this contract
  const authorUsername = _getUserAddress(proposal, collectiveId, 'MEMBER');
  const user = Meteor.users.findOne({ username: (proposal && proposal.proposer) ? proposal.proposer.toLowerCase() : authorUsername });

  if (user && proposal && proposal.applicant) {
    const elements = proposal;

    const userInfo = Meteor.users.findOne({ username: proposal.applicant.toLowerCase() });
    if (userInfo) {
      elements.applicantId = userInfo._id;
    }

    const contract = {
      title: parseContent(TAPi18n.__('moloch-map-submit-proposal'), elements),
      keyword: `${index}`,
      date: new Date(proposal.startingPeriod * 1000),
      publicAddress: proposal.proposer,
      height: 0,
      calendar: new Date(proposal.startingPeriod * 1000),
      importId: `${collectiveId}-${index}`,
      proposalIndex: index,
      pollChoiceId: '',
      pollId: '',
      collectiveId,
      poll: [],
      didPass: proposal.didPass,
      processed: proposal.processed,
      aborted: proposal.aborted,
      closing: {
        blockchain: defaults.CHAIN,
        height: 0,
        calendar: new Date(proposal.startingPeriod * 1000),
        delta: 0,
      },
      decision: {
        applicant: proposal.applicant.toLowerCase(),
        request: new BigNumber(proposal.sharesRequested).toString(),
        tribute: new BigNumber(proposal.tokenTribute).toString(),
        requestToken: defaults.TOKEN,
        tributeToken: defaults.TRIBUTE,
      },
    };

    const contractObject = getContractObject(user, contract);
    const newContractId = _setContract(contractObject.importId, contractObject);

    // poll
    if (proposal.yesVotes && proposal.noVotes) {
      const yes = new BigNumber(proposal.yesVotes);
      const no = new BigNumber(proposal.noVotes);

      const choices = ['no', 'yes'];
      const choiceContract = [];
      let choice;
      let contractPollChoice;
      for (let k = 0; k < choices.length; k += 1) {
        choice = contract;
        choice.title = TAPi18n.__(`moloch-${choices[k]}`);
        choice.keyword = `${index}/${choices[k]}`;
        choice.pollChoiceId = k.toString();
        choice.importId = `${collectiveId}-${index}-${choices[k]}`;
        choice.proposalIndex = index;
        choice.pollId = newContractId;
        choice.poll = [];
        choice.blockchain = {
          score: {
            totalConfirmed: (choices[k] === 'yes') ? yes.toString() : no.toString(),
            finalConfirmed: (choices[k] === 'yes') ? yes.toNumber() : no.toNumber(),
          },
        };
        contractPollChoice = getContractObject(user, choice);
        choiceContract.push(_setContract(`${collectiveId}-${index}-${choices[k]}`, contractPollChoice));
      }

      // create poll data array
      const finalPoll = [];
      for (let n = 0; n < choiceContract.length; n += 1) {
        finalPoll.push({
          contractId: choiceContract[n],
          totalStaked: (choices[n] === 'yes') ? yes.toString() : no.toString(),
        });
      }

      log(`[web3] Adding new new poll ${JSON.stringify(finalPoll)}`);

      // update original contract
      Contracts.update({ _id: newContractId }, { $set: { poll: finalPoll } });
      log(`[web3] Poll added to contract: ${newContractId}`);
    }
  }
};

/**
* @summary stroes in the collective the summon date of the dao
* @param {object} log with event descriptions from the blockchain
* @param {object} map with info how to write these eventos on the blockchain
* @param {string} collectiveId this is being subscribed to
* @param {object} block with data from chain of this event
*/
const _mirrorCollectiveEvent = (event, collectiveId, block) => {
  log(`[web3] Mirroring collective data for ${collectiveId}`);

  const collective = Collectives.findOne({ _id: collectiveId });

  // summoner
  const summoner = _getUserAddress(event, collectiveId);
  const contractDate = new Date(block.timestamp * 1000);
  const settings = {
    profile: {
      wallet: {
        address: [{
          hash: summoner.toLowerCase(),
          chain: defaults.BLOCKCHAIN,
        }],
        ledger: [{
          collectiveId,
          txId: event.transactionHash,
          token: defaults.TOKEN,
          value: 1,
          timestamp: contractDate,
        }],
        reserves: [{
          collectiveId,
          publicAddress: collective.profile.blockchain.publicAddress.toLowerCase(),
          token: defaults.TOKEN,
          balance: 1,
          available: 1,
          placed: 0,
          memberSince: contractDate,
          membership: 'MEMBER',
        }],
      },
    },
  };
  migrateAddress(summoner, settings);


  // summon event
  const member = Meteor.users.findOne({ username: summoner });
  const elements = event.returnValues;
  if (member) {
    elements.summonerId = member._id;
  }

  const contract = {
    title: parseContent(TAPi18n.__('moloch-map-summon'), elements),
    keyword: `${event.transactionHash}`,
    url: `/tx/${event.transactionHash}`,
    date: contractDate,
    createdAt: contractDate,
    lastUpdate: contractDate,
    timestamp: contractDate,
    publicAddress: summoner,
    height: 0,
    calendar: contractDate,
    importId: `${collectiveId}-summon-${event.logIndex}`,
    proposalIndex: event.logIndex,
    pollChoiceId: '',
    pollId: '',
    collectiveId,
    poll: [],
    decision: {
      shares: event.returnValues.shares,
      summoner: event.returnValues.summoner,
    },
    period: 'SUMMON',
    signatures: [
      {
        _id: member._id,
        role: 'AUTHOR',
        username: member.username,
        status: 'CONFIRMED',
      },
    ],
  };

  log(`[web3] Creating a summon contract with importID: ${collectiveId}-summon-${event.logIndex} ...`);
  const contractObject = getContractObject(member, contract);
  _setContract(contractObject.importId, contractObject);

  // update collective with summoning time
  if (collective) {
    const summoningTime = new Date(block.timestamp * 1000);
    Collectives.update({ _id: collectiveId }, { $set: { 'profile.summoningTime': summoningTime } }, (err, res) => {
      if (err) {
        console.log(err);
      }
      log(`[web3] Summoning time for this DAO collective is ${block.timestamp}`);
      return res;
    });
  }
};

/**
* @summary rage quit mirror persisting in local instance
* @param {object} event with event descriptions from the blockchain
* @param {object} map with info how to write these eventos on the blockchain
* @param {string} collectiveId this is being subscribed to
* @param {object} block with data from chain of this event
*/
const _mirrorUserEvent = (event, collectiveId, block) => {
  const authorUsername = event.returnValues.memberAddress.toLowerCase();
  const member = Meteor.users.findOne({ username: authorUsername });
  const collective = Collectives.findOne({ _id: collectiveId });

  let reserves;
  const shares = parseInt(parseInt(_checkPrecedent(authorUsername, collectiveId) - new BigNumber(event.returnValues.sharesToBurn).toNumber(), 10), 10);
  const sharesToBurn = parseInt(0 - parseInt(new BigNumber(event.returnValues.sharesToBurn).toNumber(), 10), 10);
  const contractDate = new Date(block.timestamp * 1000);

  if (member && member.profile.wallet && member.profile.wallet.reserves && member.profile.wallet.reserves.length > 0) {
    reserves = member.profile.wallet.reserves;
    for (let i = 0; i < reserves.length; i += 1) {
      if (reserves[i].token === defaults.TOKEN && reserves[i].publicAddress === collective.profile.blockchain.publicAddress.toLowerCase()) {
        reserves[i].balance = shares;
        reserves[i].available = reserves[i].balance;
      }
    }
  } else {
    reserves = [{
      collectiveId,
      publicAddress: collective.profile.blockchain.publicAddress.toLowerCase(),
      token: defaults.TOKEN,
      balance: shares,
      available: shares,
      placed: 0,
      memberSince: new Date(block.timestamp * 1000),
      membership: 'MEMBER',
    }];
  }
  const settings = {
    profile: {
      wallet: {
        address: [{
          hash: authorUsername,
          chain: defaults.BLOCKCHAIN,
        }],
        ledger: [{
          collectiveId,
          txId: event.transactionHash,
          token: defaults.TOKEN,
          value: sharesToBurn.toNumber(),
          timestamp: contractDate,
        }],
        reserves,
      },
    },
  };
  log(`[web3] Updating user with Ragequit consequences: ${JSON.stringify(reserves)}...`);
  migrateAddress(authorUsername, settings);

  // now create a ragequit contract
  const contract = {
    title: parseContent(TAPi18n.__('moloch-map-rage-quit'), event.returnValues),
    keyword: `${event.transactionHash}`,
    url: `/tx/${event.transactionHash}`,
    date: contractDate,
    createdAt: contractDate,
    lastUpdate: contractDate,
    timestamp: contractDate,
    publicAddress: authorUsername,
    height: 0,
    calendar: contractDate,
    importId: `${collectiveId}-ragequit-${event.logIndex}`,
    proposalIndex: event.logIndex,
    pollChoiceId: '',
    pollId: '',
    collectiveId,
    poll: [],
    decision: {
      sharesToBurn,
    },
    period: 'RAGEQUIT',
    signatures: [
      {
        _id: member._id,
        role: 'AUTHOR',
        username: member.username,
        status: 'CONFIRMED',
      },
    ],
  };

  log(`[web3] Creating a ragequit contract for with importID: ${collectiveId}-ragequit-${event.logIndex} ...`);

  const contractObject = getContractObject(member, contract);
  const newContractId = _setContract(contractObject.importId, contractObject);

  // and create a ragequit transaction
  const quantity = parseInt(new BigNumber(event.returnValues.sharesToBurn).toNumber(), 10);
  const transactionObject = {
    input: {
      entityId: member._id,
      address: member.username.toLowerCase(),
      entityType: 'INDIVIDUAL',
      quantity,
      currency: defaults.TOKEN,
    },
    output: {
      entityId: collectiveId,
      address: collective.profile.blockchain.publicAddress.toLowerCase(),
      entityType: 'COLLECTIVE',
      quantity,
      currency: defaults.TOKEN,
    },
    kind: 'CRYPTO',
    contractId: newContractId,
    collectiveId,
    timestamp: new Date(block.timestamp * 1000),
    status: 'CONFIRMED',
    blockchain: {
      tickets: [
        {
          hash: block.blockHash,
          status: 'CONFIRMED',
          value: sharesToBurn.toNumber(),
        },
      ],
      coin: {
        code: defaults.TOKEN,
      },
      publicAddress: event.returnValues.memberAddress.toLowerCase(),
      score: {
        totalConfirmed: sharesToBurn.toString(),
        totalPending: '0',
        totalFail: '0',
        finalConfirmed: sharesToBurn.toNumber(),
        finalPending: 0,
        finalFail: 0,
        value: 0,
      },
    },
    isRagequit: true,
  };
  const txId = _setTransaction(event.returnValues.memberAddress.toLowerCase(), collectiveId, transactionObject);
  log(`[web3] Created a ragequit transaction with txId ${txId} ...`);
};

/**
* @summary gets the information of a given block.
* @param {number} blockNumber to fetch info from.
*/
const _getEventBlock = async (blockNumber) => {
  let block;
  log(`[web3] Getting data for block: ${blockNumber}`);

  await web3.eth.getBlock(blockNumber, (err, res) => {
    if (err) {
      console.log(err);
    }
    block = res;
    return res;
  });
  return block;
};

/**
* @summary writes the event log found on the blockchain to database objects according to mapping structure
* @param {object} log with event descriptions from the blockchain
* @param {object} smartContract with info how to write these eventos on the blockchain
* @param {string} collectiveId this is being subscribed to
*/
const _writeEvents = async (event, smartContract, state, collectiveId) => {
  log('[web3] Writing events found on the blockchain to local database..');

  let collective = Collectives.findOne({ _id: collectiveId });
  const lastEventIndex = (collective.profile.lastEventIndex) ? collective.profile.lastEventIndex : 0;

  log(`[web3] Obtaining from DB lastEventIndex: ${lastEventIndex}`);
  log(`[web3] Blockchain reports state.proposalQueue.length: ${state.proposalQueue.length}`);

  let chunk = _calcIncrement(15, state.proposalQueue.length);
  let increment = 0;
  let processingIndex = 0;
  for (let k = 0; k < state.proposalQueue.length; k += 1) {
    if (collective && collective.status && collective.status.blockchainSync === 'SYNCING') {
      increment += chunk;
      _updateStatus(collective, collective.status.blockchainSync, increment, TAPi18n.__('synchronizer-proposals'));
    }
    if (state !== null) {
      if (k > lastEventIndex) {
        _mirrorContractState(state, k, collectiveId);
      }
      processingIndex = k;
    }
  }

  log(`[web3] Did a total processingIndex: ${processingIndex} `);

  // save the index of last event from reading contract state
  if (processingIndex > lastEventIndex) {
    Collectives.update({ _id: collectiveId }, { $set: { 'profile.lastEventIndex': processingIndex } }, (err, res) => {
      if (err) {
        console.log(err);
      }
      log(`[web3] Updated collective with lastEventIndex ${processingIndex}`);
      return res;
    });
  }


  // get last timestamp
  let currentEventBlockTimestamp = 0;
  await web3.eth.getBlock(event[parseInt(event.length - 1, 10)].blockNumber, (err, res) => {
    if (err) {
      console.log(err);
    }
    currentEventBlockTimestamp = new Date(res.timestamp * 1000);
  });
  log(`[web3] Current event block timestamp: ${currentEventBlockTimestamp}`);

  const lastEventBlockTimestamp = (collective.profile.lastEventBlockTimestamp) ? collective.profile.lastEventBlockTimestamp : new Date(0);
  log(`[web3] Last event block timestamp: ${lastEventBlockTimestamp}`);

  let block;
  let eventTimestamp;

  // save last block timestamp from last event on last block
  if (lastEventBlockTimestamp < currentEventBlockTimestamp) {
    const map = smartContract.map;

    collective = Collectives.findOne({ _id: collectiveId });
    chunk = _calcIncrement(45, event.length);
    increment = 0;
    for (let i = 0; i < event.length; i += 1) {
      log(`[web3] Parsing event index: ${i}`);

      if (collective && collective.status && collective.status.blockchainSync === 'SYNCING') {
        increment += chunk;
        _updateStatus(collective, collective.status.blockchainSync, increment, TAPi18n.__('synchronizer-events'));
      }

      block = await _getEventBlock(event[i].blockNumber);
      eventTimestamp = new Date(block.timestamp * 1000);
      log(`[web3] Event timestamp found: ${eventTimestamp}`);

      for (let k = 0; k < map.length; k += 1) {
        if ((map[k].eventName === event[i].event) && (eventTimestamp >= lastEventBlockTimestamp)) {
          log(`[web3] Processing event: ${event[i].event}............`);
          switch (event[i].event) {
            case 'SubmitProposal':
              _mirrorContractEvent(event[i], state, collectiveId, block);
              break;
            case 'ProcessProposal':
              _mirrorTransactionState(event[i], collectiveId, block);
              break;
            case 'SubmitVote':
              _mirrorTransaction(event[i], collectiveId, block);
              break;
            case 'SummonComplete':
              _mirrorCollectiveEvent(event[i], collectiveId, block);
              break;
            case 'Ragequit':
              _mirrorUserEvent(event[i], collectiveId, block);
              break;
            default:
              log(`[web3] No interpreter function was found for event '${event[i].event}'`);
          }
        }
      }
    }
  } else {
    log('[web3] This local server is up to date with blockchain data.');
  }

  // save the index of last event from reading contract state
  const status = {
    loadPercentage: 100,
    blockchainSync: 'UPDATED',
    message: TAPi18n.__('synchronizer-finished'),
  };

  if (lastEventBlockTimestamp < currentEventBlockTimestamp) {
    Collectives.update({ _id: collectiveId }, { $set: { 'profile.lastEventBlockTimestamp': currentEventBlockTimestamp, 'profile.lastSyncedBlock': event[parseInt(event.length - 1, 10)].blockNumber, status } }, (err, res) => {
      if (err) {
        console.log(err);
      }
      log(`[web3] Updated collective with lastEventBlockTimestamp ${currentEventBlockTimestamp} and lastSyncedBlock: ${event[parseInt(event.length - 1, 10)].blockNumber}`);
      return res;
    });
  }
};

/**
* @summary checks on contract getter the length to review a specifc struct
* @param {web3} dao contract to analyze
* @param {string} lengthGetter name of the getter
*/
const _getStructLength = async (dao, lengthGetter) => {
  let result;
  await dao.methods[lengthGetter]().call({}, (err, res) => {
    if (err) {
      log(err);
    }
    result = new BigNumber(res).toNumber();
    return res;
  });
  return result;
};

/**
* @summary given a list of parameters it will obtain the current state value on chain
* @param {object} smartContract object from a collective
*/
const _getState = async (smartContract, collectiveId) => {
  const state = {};
  const abi = JSON.parse(smartContract.abi);

  log('[web3] Parsing current state of smart contract...');
  const dao = await new web3.eth.Contract(abi, smartContract.publicAddress);

  if (smartContract.parameter) {
    let length = 0;
    let increment = 0;

    let collective;
    if (collectiveId) {
      collective = Collectives.findOne({ _id: collectiveId });
    }
    const chunk = _calcIncrement(25, smartContract.parameter.length);

    const struct = [];
    for (let i = 0; i < smartContract.parameter.length; i += 1) {
      if (collectiveId && collective && collective.status.blockchainSync === 'SYNCING') {
        increment += chunk;
        _updateStatus(collective, collective.status.blockchainSync, increment, TAPi18n.__('synchronizer-contract'));
      }
      switch (smartContract.parameter[i].type) {
        case 'Proposal':
          log(`[web3] Getting struct data ${smartContract.parameter[i].name}...`);
          if (smartContract.parameter[i].length) {
            length = await _getStructLength(dao, smartContract.parameter[i].length);
          }
          for (let k = 0; k < length; k += 1) {
            await dao.methods[`${smartContract.parameter[i].name}`](k).call({}, (err, res) => {
              if (err) {
                log(err);
              }
              log(`[web3] Got struct proposal titled: "${res.details.replace('"', '\\"').substring(0, 20)}..."`);
              struct.push(res);
              return res;
            });
          }
          state[smartContract.parameter[i].name] = struct;
          break;
        case 'mapping':
        case 'function':
          break;
        default:
          log(`[web3] Getting information for method ${smartContract.parameter[i].name}...`);
          if (dao.methods[smartContract.parameter[i].name]) {
            await dao.methods[smartContract.parameter[i].name]().call({}, (err, res) => {
              if (err) {
                log(err);
              }
              state[smartContract.parameter[i].name] = res;
              return res;
            });
          }
      }
    }
  }
  return state;
};

/**
* @summary show all the transactions for a given public address
* @param {object} smartContract object from a collective
* @param {string} collectiveId this is being subscribed to
*/
const _getEvents = async (smartContract, collectiveId, fromBlock, toBlock, state) => {
  let eventLog;

  if (_web3()) {
    log(`[web3] Getting events for ${smartContract.publicAddress} from block ${fromBlock} to ${toBlock}..`);
    const abi = JSON.parse(smartContract.abi);

    if (abi) {
      let events = [];
      await new web3.eth.Contract(abi, smartContract.publicAddress).getPastEvents('allEvents', {
        fromBlock,
        toBlock,
      }, (error, res) => {
        if (error) {
          log('[web3] Error fetching log data.');
          log(error);
        }
        events = res;
        return res;
      });

      if (events.length > 0 && smartContract.map && smartContract.map.length > 0) {
        log(`[web3] Log for ${smartContract.publicAddress} has a length of ${events.length} events.`);
        let daoState;
        if (!state) {
          daoState = await _getState(smartContract);
        } else {
          daoState = state;
        }
        await _writeEvents(events, smartContract, daoState, collectiveId);
      } else {
        log('[web3] No new events found.');
      }
    }
  }
  return eventLog;
};


/**
* @summary detects if a given address has a working DAO on-chain
* @param {string} publicAddress to be scanned
* @return {string} type of DAO
*/
const _hasDAO = async (publicAddress) => {
  log(`[web3] Verifying if ${publicAddress} has a DAO....`);
  if (_web3()) {
    for (const template of DAOTemplates) {
      log(`[web3] Comparing with ${template.kind} template...`);
      for (const contract of template.profile.blockchain.smartContracts) {
        log(`[web3] Reading smart contract ${contract.label} with publicAddress: ${publicAddress}...`);
        if (contract.map && contract.map.length > 0) {
          for (const event of contract.map) {
            if (event.fingerprint) {
              log(`[web3] Looking for fingerprint event ${event.fingerprint}...`);
              const abi = JSON.parse(contract.abi);

              if (abi) {
                const chainLog = await new web3.eth.Contract(abi, publicAddress).getPastEvents(event.eventName, {
                  fromBlock: defaults.START_BLOCK,
                  toBlock: 'latest',
                }, (error, res) => {
                  if (error) {
                    log('[web3] Error fetching log data.');
                    log(error);
                  }
                  return res;
                });

                if (chainLog && chainLog.length > 0) {
                  chainLog.kind = template.kind;
                  return chainLog;
                }
              }
            }
          }
        }
      }
    }
  }
  return false;
};


/**
* @summary get current height of the blockchain
*/
const _getBlockHeight = async () => {
  if (_web3()) {
    const dateDelta = parseInt((new Date().getTime() - lastBlockHeightTimestamp.getTime()) / 1000, 10);
    if (!blockHeight || dateDelta > (blocktimes.ETHEREUM_SECONDS_PER_BLOCK * 5)) {
      blockHeight = await web3.eth.getBlockNumber().then((blockNumber) => {
        lastBlockHeightTimestamp = new Date();
        return blockNumber;
      });
    }
  }

  log(`[web3] Latest block height is ${blockHeight}`);
  return blockHeight;
};


/**
* @summary get the last timestamp from the last block
*/
const _getLastTimestamp = async () => {
  if (_web3()) {
    return await _getBlockHeight().then(async (resolved) => {
      return await web3.eth.getBlock(resolved).then((res) => {
        if (res) return parseInt(res.timestamp * 1000, 10);
        return undefined;
      });
    });
  }
  return undefined;
};

/**
* @summary adds and subtracts based on database queries
* @param {object} additionQuery to the mongo db
* @param {object} subtractionQuery to the mongo db
* @param {string} additionDecision to request
* @param {string} subtractionDecision to request
*/
const _getTokenBalance = (additionQuery, subtractionQuery, additionDecision, subtractionDecision) => {
  const additions = Contracts.find(additionQuery).fetch();
  const finalSum = _.reduce(additions, (memo, num) => { return new BigNumber(memo).plus(new BigNumber(num.decision[additionDecision])); }, 0);
  const subs = Contracts.find(subtractionQuery).fetch();
  const finalSub = _.reduce(subs, (memo, num) => { return new BigNumber(memo).plus(new BigNumber(num.decision[subtractionDecision])); }, 0);
  return new BigNumber(finalSum).plus(new BigNumber(finalSub)).toString();
};

/**
* @summary given a parameter, finds the instructions to instantiate it on chain
* @param {object} collective with maps
* @param {string} parameter to fish in maps
*/
const _getCoordinates = (collective, parameter) => {
  const smartContracts = collective.profile.blockchain.smartContracts;
  let found = false;
  let abi;
  let publicAddress;
  let coordinate;
  for (let i = 0; i < smartContracts.length; i += 1) {
    coordinate = _.findWhere(smartContracts[i].parameter, { name: parameter });
    if (coordinate && coordinate.name === parameter) {
      found = true;
      abi = smartContracts[i].abi;
      publicAddress = smartContracts[i].publicAddress;
      break;
    }
  }
  if (found) {
    return {
      abi,
      publicAddress,
    };
  }
  return undefined;
};

/**
* @summary calls a method from a collective
* @param {object} collective with maps
* @param {string} methodName to call
*/
const _callMethod = async (collective, methodName) => {
  const contract = _getCoordinates(collective, methodName);
  let response;
  if (contract) {
    const abi = JSON.parse(contract.abi);
    const dao = await new web3.eth.Contract(abi, contract.publicAddress);

    await dao.methods[methodName]().call({}, (err, res) => {
      if (err) {
        console.log(err);
      }
      response = res.toString();
    });
  }
  return response;
};


/**
* @summary formats number for a string
* @param {number} quantity of zeroes
*/
const _writeZeroes = (quantity) => {
  let template = '';
  for (let i = 0; i < quantity; i += 1) {
    template += '0';
  }
  return template;
};

/**
* @summary big number to number
* @param {BigNumber} valueBN of a big number
* @param {string} tokenCode token
* @return {number} final value
*/
const _BNToNumber = (value, coin) => {
  const valueBN = new BigNumber(value);
  let text = valueBN.toFixed(); // toString().replace('.', '');
  const template = _writeZeroes(coin.decimals + 1);
  if (text.length < template.length) { text = `${_writeZeroes(template.length - text.length)}${text}`; }
  const comma = text.insert('.', (text.length - coin.decimals));
  const final = new BigNumber(comma);
  return final.toNumber();
};

/**
* @summary returns a formatted result of the balance for any given address with a specific token
* @param {object} coin with token meta data
* @param {string} publicAddress to check balance on chain
*/
const _balanceOf = async (coin, publicAddress) => {
  const contract = await new web3.eth.Contract(erc20, coin.contractAddress);
  let response;

  await contract.methods.balanceOf(publicAddress).call({}, (err, res) => {
    if (err) {
      console.log(err);
    }
    response = res;
  });
  const finalNumber = _BNToNumber(response, coin);
  return finalNumber.toString();
};

/**
* @summary gets a random dark color
*/
let color;
function _addDigitToColor(limit) {
  const letters = '0123456789ABCDEF'.split('');
  color += letters[Math.round(Math.random() * limit)];
}
function _getRandomColor() {
  color = '#';
  _addDigitToColor(5);
  for (let i = 0; i < 5; i += 1) {
    _addDigitToColor(15);
  }
  return color;
}

/**
* @summary creates a token on db based on an erc20 public address
* @param {string} publicAddress to check balance on chain
*/
const _setToken = async (publicAddress) => {
  log(`[web3] Inserting new found ERC20 token with publicAddress: ${publicAddress}`);
  const contract = await new web3.eth.Contract(erc20, publicAddress);

  const template = {
    format: '0,0.00',
    color: _getRandomColor(),
    type: 'ERC20',
    blockchain: defaults.BLOCKCHAIN,
    contractAddress: publicAddress,
    defaultVote: 1,
    editor: {
      allowBalanceToggle: true,
      allowBlockchainAddress: true,
    },
  };

  await contract.methods.symbol().call({}, (err, res) => {
    if (err) {
      console.log(err);
    }
    template.code = res;
  });

  await contract.methods.name().call({}, (err, res) => {
    if (err) {
      console.log(err);
    }
    template.name = res;
    template.title = TAPi18n.__('token-default-title').replace('{{name}}', res);
  });

  await contract.methods.decimals().call({}, (err, res) => {
    if (err) {
      console.log(err);
    }
    template.decimals = res;
  });

  await contract.methods.totalSupply().call({}, (err, res) => {
    if (err) {
      console.log(err);
    }
    template.supply = res;
    template.maxSupply = res;
  });

  return await insertToken(template);
};


/**
* @summary for a given asset or token it returns value from its oracle
* @param {object} coin with token meta data
*/
const _askOracle = async (coin) => {
  if (coin.oracle && coin.oracle.abi && coin.oracle.address && coin.oracle.method) {
    const abi = JSON.parse(coin.oracle.abi);
    const contract = await new web3.eth.Contract(abi, coin.oracle.address);
    let response;
    await contract.methods[coin.oracle.method]().call({}, (err, res) => {
      if (err) {
        console.log(err);
      }
      response = res;
    });
    let finalNumber;
    if (coin.oracle.decimals) {
      finalNumber = parseFloat(response / Math.pow(10, coin.oracle.decimals), 10);
    } else {
      finalNumber = _BNToNumber(response, coin);
    }
    return finalNumber.toString();
  }
  log(`[web3] Did not found oracle for ${JSON.stringify(coin)}`);
  return 0;
};

/**
* @summary gets all the transfers (from and to) that happened betweent a token and an address
* @param {object} coin with token data
* @param {string} publicAddress interacting with token
*/
const _getTransfers = async (coin, publicAddress, eventName, fromBlock, toBlock, filter) => {
  log(`[web3] Getting transfers for ${publicAddress} history with ${coin.code} with filter: ${JSON.stringify(filter)}`);
  let transfers;

  await new web3.eth.Contract(erc20, coin.contractAddress).getPastEvents(eventName, {
    filter,
    fromBlock,
    toBlock,
  }, (error, res) => {
    if (error) {
      log('[web3] Error fetching log data.');
      log(error);
    }
    transfers = res;
  });

  return transfers;
};


/**
* @summary makes the information readable by the dapp
* @param {object} feed with blockchain events
* @param {object} coin with data to parse feed
*/
const _generateDataset = async (feed, coin) => {
  const dataset = [];
  let block;
  for (let i = 0; i < feed.length; i += 1) {
    block = await _getEventBlock(feed[i].blockNumber);
    dataset.push({
      t: new Date(block.timestamp * 1000),
      y: parseFloat(_BNToNumber(feed[i].returnValues._value, coin), 10),
    });
  }
  return dataset;
};


/**
* @summary turns a dataset with historic activity into a cumulative dataset
* @param {object} dataset to parse
*/
const _cummulative = (dataset) => {
  const cummlativeSet = dataset;
  for (let i = 1; i < dataset.length; i += 1) {
    cummlativeSet[i].y = parseFloat(cummlativeSet[i].y + cummlativeSet[i - 1].y, 10);
  }
  return cummlativeSet;
};


/**
* @summary creates a chart based on the activity of a public address with a token
* @param {object} coin with token data
* @param {string} publicAddress interacting with token
*/
const _buildChart = async (coin, publicAddress, fromBlock, toBlock) => {
  const income = await _getTransfers(coin, publicAddress, 'Transfer', fromBlock, toBlock, { _to: publicAddress });
  const outcome = await _getTransfers(coin, publicAddress, 'Transfer', fromBlock, toBlock, { _from: publicAddress });
  const firstPass = await _generateDataset(income, coin);
  const negativePass = _.map(await _generateDataset(outcome, coin), (item) => { const newItem = item; newItem.y *= -1; return newItem; });

  const allBlocks = income.concat(outcome);
  if (allBlocks.length > 0) {
    const lastSyncedBlock = _.sortBy(allBlocks, 'blockNumber')[allBlocks.length - 1].blockNumber;
    const dataset = _.reject(_.sortBy(firstPass.concat(negativePass), 't'), (item) => { return (item.y === 0); });
    const final = {
      data: _cummulative(dataset),
      lastSyncedBlock,
    };
    return final;
  }

  return {
    data: [],
    lastSyncedBlock: blockHeight,
  };
};


/**
* @summary when an existing chart needs updating and new information is added to the cummulative
* @param {array} legacy values
* @param {array} update values
*/
const _updateChart = (legacy, update) => {
  const finalUpdate = legacy;
  let newY;
  for (let i = 0; i < update.length; i += 1) {
    if (i === 0) {
      newY = parseFloat(legacy.length > 0?legacy[legacy.length - 1].y:0 + update[i].y, 10);
    } else {
      newY = parseFloat(update[i].y + finalUpdate[finalUpdate.length - 1].y, 10);
    }
    finalUpdate.push({
      t: update[i].t,
      y: newY,
    });
  }

  return finalUpdate;
};

/**
* @summary gets the current value of the guild for each DAO
*/
const _sync = async () => {
  const collectives = Collectives.find({ 'status.blockchainSync': 'UPDATED' }).fetch();
  let ticker;

  let finalGuild;
  let coin;
  let totalAssets;
  let totalShares;
  let daoGuild;

  coin = Tokens.findOne({ code: 'USD' });
  let oracleValue;

  for (let i = 0; i < collectives.length; i += 1) {
    log(`[dao] Updating guild data ${collectives[i].name}...`);
    if (collectives[i].profile.guild) {
      finalGuild = collectives[i].profile.guild;
      for (let k = 0; k < collectives[i].profile.guild.length; k += 1) {
        switch (collectives[i].profile.guild[k].name) {
          case 'guild-total-shares':
            finalGuild[k].value = await _callMethod(collectives[i], 'totalShares');
            log(`[dao] Total shares for this DAO... ${finalGuild[k].value}`);
            Collectives.update({ _id: collectives[i]._id }, { $set: { 'profile.guild': finalGuild } });
            break;
          case 'guild-total-assets':
            ticker = _.findWhere(_.findWhere(collectives[i].profile.blockchain.smartContracts, { label: 'DAO' }).parameter, { name: 'approvedToken' }).value;
            coin = Tokens.findOne({ contractAddress: RegExp(['^', ticker, '$'].join(''), 'i') });
            // coin = Tokens.findOne({ code: ticker });
            if (coin) {
              daoGuild = _.findWhere(collectives[i].profile.blockchain.smartContracts, { label: 'GuildBank' });
              finalGuild[k].value = await _balanceOf(coin, daoGuild.publicAddress);
              const chart = _.findWhere(collectives[i].profile.chart, { guildLabel: collectives[i].profile.guild[k].name });
              let finalChart;
              let dataset;
              if (!chart || !chart.dataset || chart.dataset.length === 0) {
                dataset = await _buildChart(coin, daoGuild.publicAddress, defaults.START_BLOCK, 'latest');
                finalChart = [{
                  guildLabel: collectives[i].profile.guild[k].name,
                  type: 'lineal',
                  dataset: [dataset],
                  lastSyncedBlock: dataset.lastSyncedBlock,
                }];
              } else if (chart.dataset && chart.dataset.length > 0) {
                const initialBlock = parseInt(_.findWhere(collectives[i].profile.chart, { guildLabel: collectives[i].profile.guild[k].name }).lastSyncedBlock + 1, 10);
                dataset = await _buildChart(coin, daoGuild.publicAddress, (!initialBlock) ? defaults.START_BLOCK : initialBlock, 'latest');
                finalChart = [chart];
                if (dataset) {
                  finalChart[0].dataset[0].data = _updateChart(finalChart[0].dataset[0].data, dataset.data);
                  finalChart[0].lastSyncedBlock = dataset.lastSyncedBlock;
                }
              }

              log(`[dao] Total assets for this DAO... ${ticker} ${finalGuild[k].value}`);
              Collectives.update({ _id: collectives[i]._id }, { $set: { 'profile.guild': finalGuild, 'profile.chart': finalChart } });
            }
            break;
          case 'guild-share-value':
          case 'guild-total-value':
            ticker = _.findWhere(_.findWhere(collectives[i].profile.blockchain.smartContracts, { label: 'DAO' }).parameter, { name: 'approvedToken' }).value;
            coin = Tokens.findOne({ contractAddress: RegExp(['^', ticker, '$'].join(''), 'i') });
            totalAssets = _.findWhere(collectives[i].profile.guild, { name: 'guild-total-assets' }).value;
            oracleValue = await _askOracle(coin);
            if (collectives[i].profile.guild[k].name === 'guild-total-value') {
              finalGuild[k].value = parseFloat(totalAssets.toNumber() * oracleValue.toNumber(), 10).toString();
              log(`[dao] Total value of DAO... ${ticker} ${finalGuild[k].value}`);
            } else if (collectives[i].profile.guild[k].name === 'guild-share-value') {
              totalShares = _.findWhere(collectives[i].profile.guild, { name: 'guild-total-shares' }).value;
              finalGuild[k].value = parseFloat((totalAssets.toNumber() / totalShares.toNumber()) * oracleValue.toNumber(), 10).toString();
              log(`[dao] Share value of DAO... ${ticker} ${finalGuild[k].value}`);
            }
            if (coin && totalAssets) {
              Collectives.update({ _id: collectives[i]._id }, { $set: { 'profile.guild': finalGuild } });
            }
            break;
          default:
        }
      }
    }
  }
};


if (Meteor.isServer) {
  _web3();
}

export const hasDAO = _hasDAO;
export const setTransaction = _setTransaction;
export const sync = _sync;
export const getLastTimestamp = _getLastTimestamp;
export const getEvents = _getEvents;
export const getShares = _getShares;
export const getState = _getState;
export const getContract = _getContract;
export const getBlockHeight = _getBlockHeight;
export const setToken = _setToken;
