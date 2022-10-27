// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// This version currently just support ERC721
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract MochiNFTEscrowV2 is
    IERC721Receiver,
    Pausable,
    Ownable,
    ReentrancyGuard
{
    struct RequiredItem {
        address tokenAddress;
        uint256 tokenId;
    }

    struct TradeItem {
        address tokenAddress;
        uint256 tokenId;
        bool exists;
    }

    struct TradeOffer {
        address owner;
        address recipient;
        bool isOwnerCancelled;
        bool isRecipientCancelled;
        bool isClosed;
        bool isOwnerDeposited;
        bool isRecipientDeposited;
        uint swapBlockNumber;
    }

    // tradeId => trade
    mapping(string => TradeOffer) public trades;
    // tradeId => is have => requiredItems
    mapping(string => mapping(bool => RequiredItem[])) public requiredItems;

    // from/to address => tradeIds
    mapping(address => string[]) public userTrades;

    // tradeId => owner address => itemIds
    mapping(string => mapping(address => uint256[])) public userDepositedItems;
    TradeItem[] public depositedItems;

    event TradeCreated(string indexed tradeId, address indexed owner);
    event TradeCancelled(string indexed tradeId, address indexed cancelledUser);
    event TradeSuccess(
        string indexed tradeId,
        address indexed from,
        address indexed to
    );

    event Deposit(string indexed tradeId, address indexed user);
    event Withdraw(string indexed tradeId, address indexed user);

    constructor() {}

    modifier whenTradeOpen(string calldata tradeId) {
        TradeOffer memory trade = trades[tradeId];
        require(trade.owner != address(0), "trade not exist");
        require(trade.isClosed == false, "trade is closed");
        _;
    }

    modifier notContract() {
        require(!Address.isContract(msg.sender), "not allow contract");
        _;
    }

    function wantItemsOf(string calldata tradeId)
        public
        view
        returns (RequiredItem[] memory)
    {
        return requiredItems[tradeId][false];
    }

    function haveItemsOf(string calldata tradeId)
        public
        view
        returns (RequiredItem[] memory)
    {
        return requiredItems[tradeId][true];
    }

    function depositedItemsOf(string calldata tradeId, address user)
        public
        view
        returns (TradeItem[] memory)
    {
        uint256[] memory itemIds = userDepositedItems[tradeId][user];
        TradeItem[] memory items = new TradeItem[](itemIds.length);
        for (uint256 i = 0; i < itemIds.length; i++) {
            TradeItem memory tradeItem = depositedItems[itemIds[i]];
            items[i] = tradeItem;
        }
        return items;
    }

    function tradesOf(address user) public view returns (TradeOffer[] memory) {
        string[] memory userTradeIds = userTrades[user];
        TradeOffer[] memory userOffers = new TradeOffer[](userTradeIds.length);
        for (uint256 i = 0; i < userTradeIds.length; i++) {
            TradeOffer memory trade = trades[userTradeIds[i]];
            userOffers[i] = trade;
        }
        return userOffers;
    }

    function tradeIds(address user) public view returns (string[] memory) {
        return userTrades[user];
    }

    function depositAll(
        string calldata tradeId,
        address owner,
        RequiredItem[] calldata _haveItems,
        RequiredItem[] calldata _wantItems
    ) public notContract whenNotPaused {
        if (trades[tradeId].owner == address(0)) {
            _createTradeOffer(tradeId, owner, _haveItems, _wantItems);
        }
        _depositAll(tradeId);
    }

    function cancelTradeOffer(string calldata tradeId)
        external
        notContract
        whenNotPaused
        whenTradeOpen(tradeId)
    {
        TradeOffer storage trade = trades[tradeId];
        require(
            msg.sender == trade.owner || msg.sender == trade.recipient,
            "only owner or recipient"
        );
        _withdrawAll(tradeId, trade.owner);
        _withdrawAll(tradeId, trade.recipient);
        if (msg.sender == trade.owner) {
            trade.isOwnerCancelled = true;
        } else {
            trade.isRecipientCancelled = true;
        }
        trade.isClosed = true;
        emit TradeCancelled(tradeId, msg.sender);
    }

    function _createTradeOffer(
        string calldata tradeId,
        address owner,
        RequiredItem[] calldata _haveItems,
        RequiredItem[] calldata _wantItems
    ) internal whenNotPaused {
        require(trades[tradeId].owner == address(0), "trade id already exists");
        TradeOffer storage trade = trades[tradeId];
        trade.owner = owner;
        for (uint i = 0; i < _haveItems.length; i++) {
            requiredItems[tradeId][true].push(_haveItems[i]);
        }
        for (uint i = 0; i < _wantItems.length; i++) {
            requiredItems[tradeId][false].push(_wantItems[i]);
        }
        userTrades[owner].push(tradeId);
        emit TradeCreated(tradeId, owner);
    }

    function _depositAll(string calldata tradeId)
        internal
        whenTradeOpen(tradeId)
    {
        TradeOffer storage trade = trades[tradeId];
        uint256[] storage depositedItemIds = userDepositedItems[tradeId][
            msg.sender
        ];
        bool isOwner = msg.sender == trade.owner;
        RequiredItem[] memory userRequiredItems = requiredItems[tradeId][
            isOwner
        ];
        for (uint256 i = 0; i < userRequiredItems.length; i++) {
            RequiredItem memory item = userRequiredItems[i];
            IERC721(item.tokenAddress).safeTransferFrom(
                msg.sender,
                address(this),
                item.tokenId
            );
            TradeItem memory tradeItem = TradeItem(
                item.tokenAddress,
                item.tokenId,
                true
            );
            depositedItems.push(tradeItem);
            depositedItemIds.push(depositedItems.length - 1);
        }
        if (!isOwner) {
            trade.recipient = msg.sender;
            userTrades[msg.sender].push(tradeId);
            trade.isRecipientDeposited = true;
        } else {
            trade.isOwnerDeposited = true;
        }
        emit Deposit(tradeId, msg.sender);
        // Start swapping when both deposited
        if (trade.isRecipientDeposited && trade.isOwnerDeposited) {
            _swap(tradeId);
        }
    }

    function _swap(string calldata tradeId) internal {
        TradeOffer storage trade = trades[tradeId];
        // Send 'have' items to recipient address
        uint256[] memory haveItemIds = userDepositedItems[tradeId][trade.owner];
        for (uint256 i = 0; i < haveItemIds.length; i++) {
            TradeItem memory item = depositedItems[haveItemIds[i]];
            IERC721(item.tokenAddress).safeTransferFrom(
                address(this),
                trade.recipient,
                item.tokenId
            );
        }
        // Send 'want' items to owner address
        uint256[] memory wantItemIds = userDepositedItems[tradeId][
            trade.recipient
        ];
        for (uint256 i = 0; i < wantItemIds.length; i++) {
            TradeItem memory item = depositedItems[wantItemIds[i]];
            IERC721(item.tokenAddress).safeTransferFrom(
                address(this),
                trade.owner,
                item.tokenId
            );
        }
        trade.swapBlockNumber = block.number;
        trade.isClosed = true;
        emit TradeSuccess(tradeId, trade.owner, trade.recipient);
    }

    function _withdrawAll(string calldata tradeId, address to) internal {
        uint256[] memory userDepositedItemIds = userDepositedItems[tradeId][to];
        for (uint256 i = 0; i < userDepositedItemIds.length; i++) {
            TradeItem memory item = depositedItems[userDepositedItemIds[i]];
            if (!item.exists) continue;
            IERC721(item.tokenAddress).safeTransferFrom(
                address(this),
                to,
                item.tokenId
            );
            item.exists = false;
        }
        emit Withdraw(tradeId, to);
    }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
        return
            bytes4(
                keccak256("onERC721Received(address,address,uint256,bytes)")
            );
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
