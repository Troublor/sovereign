const _moloch = {
  name: '{{name}}',
  domain: '{{domain}}',
  emails: [],
  kind: 'MOLOCH',
  profile: {
    logo: '{{logo}}',
    website: '{{website}}',
    bio: '{{bio}}',
    guild: [
      {
        name: 'guild-total-shares',
        type: 'token.SHARES',
      },
      {
        name: 'guild-total-assets',
        type: '{{tokenTicker}}',
      },
      {
        name: 'guild-share-value',
        type: 'token.USD',
      },
      {
        name: 'guild-total-value',
        type: 'token.USD',
      },
    ],
    menu: [
      {
        separator: true,
        label: 'moloch-period',
      },
      {
        label: 'moloch-all',
        icon: 'images/decision-constitution.png',
        iconActivated: 'images/decision-constitution-active.png',
        feed: 'user',
        value: true,
        separator: false,
        url: '/',
        displayToken: false,
        displayCount: true,
      },
      {
        label: 'moloch-queue',
        icon: 'images/decision-open.png',
        iconActivated: 'images/decision-open-active.png',
        feed: 'user',
        value: true,
        separator: false,
        url: '/?period=queue',
        displayToken: false,
        displayCount: true,
      },
      {
        label: 'moloch-voting-period',
        icon: 'images/decision-vote.png',
        iconActivated: 'images/decision-vote-active.png',
        feed: 'user',
        value: true,
        separator: false,
        url: '/?period=voting',
        displayToken: false,
        displayCount: true,
      },
      {
        label: 'moloch-grace-period',
        icon: 'images/decision-proposals.png',
        iconActivated: 'images/decision-proposals-active.png',
        feed: 'user',
        value: true,
        separator: false,
        url: '/?period=grace',
        displayToken: false,
        displayCount: true,
      },
      {
        label: 'moloch-ready-processing',
        icon: 'images/decision-draft.png',
        iconActivated: 'images/decision-draft-active.png',
        feed: 'user',
        value: true,
        separator: false,
        url: '/?period=process',
        displayToken: false,
        displayCount: true,
      },
      {
        separator: true,
        label: 'moloch-results',
      },
      {
        label: 'moloch-passed',
        icon: 'images/decision-approved.png',
        iconActivated: 'images/decision-approved-active.png',
        feed: 'user',
        value: true,
        separator: false,
        url: '/?period=passed',
        displayToken: false,
        displayCount: true,
      },
      {
        label: 'moloch-failed',
        icon: 'images/decision-rejected.png',
        iconActivated: 'images/decision-rejected-active.png',
        feed: 'user',
        value: true,
        separator: false,
        url: '/?period=rejected',
        displayToken: false,
        displayCount: true,
      },
      {
        label: 'moloch-ragequit',
        icon: 'images/decision-ragequit.png',
        iconActivated: 'images/decision-ragequit-active.png',
        feed: 'user',
        value: true,
        separator: false,
        url: '/?period=ragequit',
        displayToken: false,
        displayCount: true,
      },
    ],
    blockchain: {
      isDAO: true,
      publicAddress: '{{publicAddress}}',
      smartContracts: [
        {
          label: 'DAO',
          publicAddress: '{{publicAddress}}',
          abi: `
          [
    {
      "constant": true,
      "inputs": [],
      "name": "processingReward",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "memberAddress",
          "type": "address"
        },
        {
          "name": "proposalIndex",
          "type": "uint256"
        }
      ],
      "name": "getMemberProposalVote",
      "outputs": [
        {
          "name": "",
          "type": "uint8"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "getCurrentPeriod",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "",
          "type": "address"
        }
      ],
      "name": "members",
      "outputs": [
        {
          "name": "delegateKey",
          "type": "address"
        },
        {
          "name": "shares",
          "type": "uint256"
        },
        {
          "name": "exists",
          "type": "bool"
        },
        {
          "name": "highestIndexYesVote",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "totalSharesRequested",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "newDelegateKey",
          "type": "address"
        }
      ],
      "name": "updateDelegateKey",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "totalShares",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "proposalQueue",
      "outputs": [
        {
          "name": "proposer",
          "type": "address"
        },
        {
          "name": "applicant",
          "type": "address"
        },
        {
          "name": "sharesRequested",
          "type": "uint256"
        },
        {
          "name": "startingPeriod",
          "type": "uint256"
        },
        {
          "name": "yesVotes",
          "type": "uint256"
        },
        {
          "name": "noVotes",
          "type": "uint256"
        },
        {
          "name": "processed",
          "type": "bool"
        },
        {
          "name": "didPass",
          "type": "bool"
        },
        {
          "name": "aborted",
          "type": "bool"
        },
        {
          "name": "tokenTribute",
          "type": "uint256"
        },
        {
          "name": "details",
          "type": "string"
        },
        {
          "name": "maxTotalSharesAtYesVote",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "",
          "type": "address"
        }
      ],
      "name": "memberAddressByDelegateKey",
      "outputs": [
        {
          "name": "",
          "type": "address"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "gracePeriodLength",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "abortWindow",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "getProposalQueueLength",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "summoningTime",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "votingPeriodLength",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "sharesToBurn",
          "type": "uint256"
        }
      ],
      "name": "ragequit",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "proposalDeposit",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "startingPeriod",
          "type": "uint256"
        }
      ],
      "name": "hasVotingPeriodExpired",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "applicant",
          "type": "address"
        },
        {
          "name": "tokenTribute",
          "type": "uint256"
        },
        {
          "name": "sharesRequested",
          "type": "uint256"
        },
        {
          "name": "details",
          "type": "string"
        }
      ],
      "name": "submitProposal",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "proposalIndex",
          "type": "uint256"
        },
        {
          "name": "uintVote",
          "type": "uint8"
        }
      ],
      "name": "submitVote",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "highestIndexYesVote",
          "type": "uint256"
        }
      ],
      "name": "canRagequit",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "guildBank",
      "outputs": [
        {
          "name": "",
          "type": "address"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "dilutionBound",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "periodDuration",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "approvedToken",
      "outputs": [
        {
          "name": "",
          "type": "address"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "proposalIndex",
          "type": "uint256"
        }
      ],
      "name": "abort",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "proposalIndex",
          "type": "uint256"
        }
      ],
      "name": "processProposal",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "name": "summoner",
          "type": "address"
        },
        {
          "name": "_approvedToken",
          "type": "address"
        },
        {
          "name": "_periodDuration",
          "type": "uint256"
        },
        {
          "name": "_votingPeriodLength",
          "type": "uint256"
        },
        {
          "name": "_gracePeriodLength",
          "type": "uint256"
        },
        {
          "name": "_abortWindow",
          "type": "uint256"
        },
        {
          "name": "_proposalDeposit",
          "type": "uint256"
        },
        {
          "name": "_dilutionBound",
          "type": "uint256"
        },
        {
          "name": "_processingReward",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "name": "proposalIndex",
          "type": "uint256"
        },
        {
          "indexed": true,
          "name": "delegateKey",
          "type": "address"
        },
        {
          "indexed": true,
          "name": "memberAddress",
          "type": "address"
        },
        {
          "indexed": true,
          "name": "applicant",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "tokenTribute",
          "type": "uint256"
        },
        {
          "indexed": false,
          "name": "sharesRequested",
          "type": "uint256"
        }
      ],
      "name": "SubmitProposal",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "proposalIndex",
          "type": "uint256"
        },
        {
          "indexed": true,
          "name": "delegateKey",
          "type": "address"
        },
        {
          "indexed": true,
          "name": "memberAddress",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "uintVote",
          "type": "uint8"
        }
      ],
      "name": "SubmitVote",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "proposalIndex",
          "type": "uint256"
        },
        {
          "indexed": true,
          "name": "applicant",
          "type": "address"
        },
        {
          "indexed": true,
          "name": "memberAddress",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "tokenTribute",
          "type": "uint256"
        },
        {
          "indexed": false,
          "name": "sharesRequested",
          "type": "uint256"
        },
        {
          "indexed": false,
          "name": "didPass",
          "type": "bool"
        }
      ],
      "name": "ProcessProposal",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "memberAddress",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "sharesToBurn",
          "type": "uint256"
        }
      ],
      "name": "Ragequit",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "proposalIndex",
          "type": "uint256"
        },
        {
          "indexed": false,
          "name": "applicantAddress",
          "type": "address"
        }
      ],
      "name": "Abort",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "memberAddress",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "newDelegateKey",
          "type": "address"
        }
      ],
      "name": "UpdateDelegateKey",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "summoner",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "shares",
          "type": "uint256"
        }
      ],
      "name": "SummonComplete",
      "type": "event"
    }
  ]
  `,
          parameter: [
            {
              name: 'summoner',
              type: 'address',
              value: '0',
            },
            {
              name: 'periodDuration',
              type: 'uint256',
              value: '17280',
            },
            {
              name: 'votingPeriodLength',
              type: 'uint256',
              value: '35',
            },
            {
              name: 'gracePeriodLength',
              type: 'uint256',
              value: '35',
            },
            {
              name: 'abortWindow',
              type: 'uint256',
              value: '5',
            },
            {
              name: 'proposalDeposit',
              type: 'uint256',
              value: '10',
            },
            {
              name: 'dilutionBound',
              type: 'uint256',
              value: '3',
            },
            {
              name: 'processingReward',
              type: 'uint256',
              value: '0.1',
            },
            {
              name: 'summoningTime',
              type: 'uint256',
              value: '0',
            },
            {
              name: 'approvedToken',
              type: 'address',
              value: '{{tokenAddress}}',
            },
            {
              name: 'proposalQueue',
              type: 'Proposal',
              value: 'struct',
              length: 'getProposalQueueLength',
            },
            {
              name: 'members',
              type: 'mapping',
            },
            {
              name: 'memberAddressByDelegateKey',
              type: 'mapping',
            },
            {
              name: 'totalShares',
              type: 'uint256',
            },
            {
              name: 'totalSharesRequested',
              type: 'uint256',
            },
            {
              name: 'getMemberProposalVote',
              type: 'function',
            },
            {
              name: 'hasVotingPeriodExpired',
              type: 'function',
            },
            {
              name: 'canRagequit',
              type: 'function',
            },
            {
              name: 'getProposalQueueLength',
              type: 'function',
            },
            {
              name: 'getCurrentPeriod',
              type: 'function',
            },
            {
              name: 'max',
              type: 'function',
            },
            {
              name: 'guildBank',
              type: 'GuildBank',
            },
          ],
          map: [
            {
              eventName: 'SummonComplete',
              collectionType: 'Contract',
              fingerprint: true,
            },
            {
              eventName: 'SubmitProposal',
              collectionType: 'Contract',
              contract: {
                title: 'moloch-map-submit-proposal',
                rules: {
                  alwaysOn: false,
                  quadraticVoting: false,
                  balanceVoting: false,
                  pollVoting: true,
                },
              },
            },
            {
              eventName: 'SubmitVote',
              collectionType: 'Contract',
              methodName: 'submitVote',
              parameter: [
                {
                  name: 'proposalIndex',
                  type: 'uint256',
                },
                {
                  name: 'uintVote',
                  type: 'uint8',
                },
              ],
            },
            {
              eventName: 'ProcessProposal',
              collectionType: 'Contract',
            },
            {
              eventName: 'UpdateDelegateKey',
              collectionType: 'Contract',
            },
            {
              eventName: 'Abort',
              collectionType: 'Contract',
            },
            {
              eventName: 'Ragequit',
              collectionType: 'Contract',
              contract: {
                title: 'moloch-map-rage-quit',
                rules: {
                  alwaysOn: false,
                  quadraticVoting: false,
                  balanceVoting: false,
                  pollVoting: false,
                },
              },
            },
            {
              methodName: 'getMemberProposalVote',
              parameter: [
                {
                  name: 'memberAddress',
                  type: 'address',
                },
                {
                  name: 'proposalIndex',
                  type: 'uint8',
                },
              ],
            },
          ],
        },
        {
          label: 'GuildBank',
          publicAddress: '{{guildAddress}}',
          abi: "[{\"constant\":false,\"inputs\":[],\"name\":\"renounceOwnership\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"owner\",\"outputs\":[{\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"isOwner\",\"outputs\":[{\"name\":\"\",\"type\":\"bool\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"receiver\",\"type\":\"address\"},{\"name\":\"shares\",\"type\":\"uint256\"},{\"name\":\"totalShares\",\"type\":\"uint256\"}],\"name\":\"withdraw\",\"outputs\":[{\"name\":\"\",\"type\":\"bool\"}],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"approvedToken\",\"outputs\":[{\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"newOwner\",\"type\":\"address\"}],\"name\":\"transferOwnership\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"name\":\"approvedTokenAddress\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"name\":\"receiver\",\"type\":\"address\"},{\"indexed\":false,\"name\":\"amount\",\"type\":\"uint256\"}],\"name\":\"Withdrawal\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"name\":\"previousOwner\",\"type\":\"address\"},{\"indexed\":true,\"name\":\"newOwner\",\"type\":\"address\"}],\"name\":\"OwnershipTransferred\",\"type\":\"event\"}]",
        },
      ],
      coin: {
        code: 'SHARES',
      },
    },
    proof: '{{proof}}',
    wallet: {
      currency: 'SHARES',
      balance: 0,
      placed: 0,
      available: 0,
    },
  },
};

const _DAOTemplates = [_moloch];

export const DAOTemplates = _DAOTemplates;
