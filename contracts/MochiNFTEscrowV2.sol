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
        address from;
        address to;
        bool isFromLock;
        bool isToLock;
        bool isFromCancelled;
        bool isToCancelled;
        bool isClosed;
    }

    // tradeIds => trade
    mapping(string => TradeOffer) public trades;
    mapping(string => RequiredItem[]) public fromItems;
    mapping(string => RequiredItem[]) public toItems;

    // from/to address => tradeIds
    mapping(address => string[]) public userTrades;

    // tradeId => owner address => itemIds
    mapping(string => mapping(address => uint256[])) public userDepositedItems;
    TradeItem[] public depositedItems;

    event TradeCreated(
        string indexed tradeId,
        address indexed from,
        address indexed to
    );
    event TradeCancelled(string indexed tradeId, address indexed cancelUser);
    event TradeSuccess(
        string indexed tradeId,
        address indexed from,
        address indexed to
    );

    event Deposit(string indexed tradeId, address indexed user);
    event Withdraw(string indexed tradeId, address indexed user);

    constructor() {}

    modifier onlyRelevant(string calldata tradeId) {
        TradeOffer memory trade = trades[tradeId];
        require(
            msg.sender == trade.from || msg.sender == trade.to,
            "you are not relevant"
        );
        _;
    }

    modifier whenTradeOpen(string calldata tradeId) {
        TradeOffer memory trade = trades[tradeId];
        require(trade.isClosed == false, "trade is closed");
        _;
    }

    modifier notContract() {
        require(!Address.isContract(msg.sender), "not allow contract");
        _;
    }

    function createTradeOffer(
        string calldata tradeId,
        address from,
        address to,
        RequiredItem[] calldata _fromItems,
        RequiredItem[] calldata _toItems
    ) external notContract whenNotPaused {
        require(trades[tradeId].from == address(0), "trade id already exists");
        require(msg.sender == from || msg.sender == to, "you are not relevant");
        TradeOffer storage trade = trades[tradeId];
        trade.from = from;
        trade.to = to;
        for (uint i = 0; i < _fromItems.length; i++) {
            fromItems[tradeId].push(_fromItems[i]);
        }
        for (uint i = 0; i < _toItems.length; i++) {
            toItems[tradeId].push(_toItems[i]);
        }
        userTrades[from].push(tradeId);
        userTrades[to].push(tradeId);
        emit TradeCreated(tradeId, from, to);
    }

    function requiredFromItems(string calldata tradeId)
        public
        view
        returns (RequiredItem[] memory)
    {
        return fromItems[tradeId];
    }

    function requiredToItems(string calldata tradeId)
        public
        view
        returns (RequiredItem[] memory)
    {
        return toItems[tradeId];
    }

    function deposit(
        string calldata tradeId,
        address tokenAddress,
        uint256[] memory tokenIds
    )
        public
        notContract
        whenNotPaused
        whenTradeOpen(tradeId)
        onlyRelevant(tradeId)
    {
        uint256[] storage depositedItemIds = userDepositedItems[tradeId][
            msg.sender
        ];
        for (uint256 i = 0; i < tokenIds.length; i++) {
            IERC721(tokenAddress).safeTransferFrom(
                msg.sender,
                address(this),
                tokenIds[i]
            );
            TradeItem memory item = TradeItem(tokenAddress, tokenIds[i], true);
            depositedItems.push(item);
            depositedItemIds.push(depositedItems.length - 1);
        }
        emit Deposit(tradeId, msg.sender);
    }

    function withdraw(
        string calldata tradeId,
        address tokenAddress,
        uint256[] memory tokenIds
    )
        public
        notContract
        whenNotPaused
        whenTradeOpen(tradeId)
        onlyRelevant(tradeId)
        nonReentrant
    {
        uint256[] memory userDepositedItemIds = userDepositedItems[tradeId][
            msg.sender
        ];
        for (uint256 i = 0; i < userDepositedItemIds.length; i++) {
            TradeItem storage item = depositedItems[userDepositedItemIds[i]];
            if (!item.exists) continue;
            if (item.tokenAddress != tokenAddress) continue;
            if (!_contain(tokenIds, item.tokenId)) continue;
            IERC721(item.tokenAddress).safeTransferFrom(
                address(this),
                msg.sender,
                item.tokenId
            );
            item.exists = false;
        }
        emit Withdraw(tradeId, msg.sender);
    }

    function withdrawAll(string calldata tradeId)
        public
        notContract
        whenNotPaused
        whenTradeOpen(tradeId)
        onlyRelevant(tradeId)
        nonReentrant
    {
        _withdrawAll(tradeId, msg.sender);
    }

    function swap(string calldata tradeId) public {
        require(swapable(tradeId), "invalid deposited items");
        TradeOffer storage trade = trades[tradeId];
        // Send 'from' items to 'to' address
        uint256[] memory fromItemIds = userDepositedItems[tradeId][trade.from];
        for (uint256 i = 0; i < fromItemIds.length; i++) {
            TradeItem memory item = depositedItems[fromItemIds[i]];
            IERC721(item.tokenAddress).approve(msg.sender, item.tokenId);
            IERC721(item.tokenAddress).safeTransferFrom(
                address(this),
                trade.to,
                item.tokenId
            );
        }
        // Send 'to' items to 'from' address
        uint256[] memory toItemIds = userDepositedItems[tradeId][trade.to];
        for (uint256 i = 0; i < toItemIds.length; i++) {
            TradeItem memory item = depositedItems[toItemIds[i]];
            IERC721(item.tokenAddress).approve(msg.sender, item.tokenId);
            IERC721(item.tokenAddress).safeTransferFrom(
                address(this),
                trade.from,
                item.tokenId
            );
        }
        trade.isClosed = true;
        emit TradeSuccess(tradeId, trade.from, trade.to);
    }

    function swapable(string calldata tradeId) public view returns (bool) {
        TradeOffer memory trade = trades[tradeId];
        RequiredItem[] memory fromRequiredItems = fromItems[tradeId];
        uint256[] memory fromDepositedItemIds = userDepositedItems[tradeId][
            trade.from
        ];
        bool fromDepositedValid = _validDeposit(
            fromRequiredItems,
            fromDepositedItemIds
        );
        RequiredItem[] memory toRequiredItems = toItems[tradeId];
        uint256[] memory toDepositedItemIds = userDepositedItems[tradeId][
            trade.to
        ];
        bool toDepositedValid = _validDeposit(
            toRequiredItems,
            toDepositedItemIds
        );
        return fromDepositedValid && toDepositedValid;
    }

    function _validDeposit(
        RequiredItem[] memory requiredItems,
        uint256[] memory depositedItemIds
    ) internal view returns (bool) {
        if (depositedItemIds.length != requiredItems.length) {
            return false;
        }
        for (uint256 i = 0; i < depositedItemIds.length; i++) {
            TradeItem memory depositedItem = depositedItems[
                depositedItemIds[i]
            ];
            RequiredItem memory requiredItem = requiredItems[i];
            if (
                depositedItem.tokenAddress != requiredItem.tokenAddress ||
                depositedItem.tokenId != requiredItem.tokenId
            ) {
                return false;
            }
        }
        return true;
    }

    function cancelTradeOffer(string calldata tradeId)
        external
        notContract
        whenNotPaused
        whenTradeOpen(tradeId)
        onlyRelevant(tradeId)
    {
        TradeOffer storage trade = trades[tradeId];
        _withdrawAll(tradeId, trade.from);
        _withdrawAll(tradeId, trade.to);
        if (msg.sender == trade.from) {
            trade.isFromCancelled = true;
        } else {
            trade.isToCancelled = true;
        }
        trade.isClosed = true;
        emit TradeCancelled(tradeId, msg.sender);
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

    function _contain(uint256[] memory list, uint256 element)
        internal
        pure
        returns (bool)
    {
        for (uint256 i = 0; i < list.length; i++) {
            if (element == list[i]) {
                return true;
            }
        }
        return false;
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
}
